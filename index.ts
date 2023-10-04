import fs from 'path';
import homebridgeLandroid from 'homebridge-landroid';
import LandroidDataset from 'homebridge-landroid/LandroidDataset';

export enum LANDROID_CHARGING_STATE {
  CHARGING = 'charging',
  NOT_CHARGING = 'notCharging',
}

export enum LANDROID_CONTACT_SENSOR_STATE {
  CONTACT_DETECTED = 'contactDetected',
  CONTACT_NOT_DETECTED = 'contactNotDetected',
}

export enum LANDROID_STATUS_LOW_BATTERY {
  BATTERY_LEVEL_LOW = 'low',
  BATTERY_LEVEL_NORMAL = 'normal',
}

export interface LandroidConfig {
  partymode?: boolean;
  debug?: boolean;
  mowdata?: boolean;
  rainsensor?: boolean;
  homesensor?: boolean;
  email: string;
  pwd: string;
}

export interface LandroidFullState {
  statusCode: number;
  statusDescription: string;
  power: boolean;
  battery: {
    level: number;
    low: boolean;
    charging: boolean;
  };
  error: boolean;
  errorCode: number;
  errorDescription: string;
  rain: boolean;
  home: boolean;
  party: boolean;
}

export interface LandroidInfo {
  name: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
}

let isReadyResolve: (value?: unknown) => void;
const isReady = new Promise((resolve) => (isReadyResolve = resolve));

let landroidPlatform: any;

const CharacteristicKeys = {
  On: 'on',
  BatteryLevel: 'batteryLevel',
  // 'statusLowBattery'
  StatusLowBattery: {
    BATTERY_LEVEL_LOW: LANDROID_STATUS_LOW_BATTERY.BATTERY_LEVEL_LOW,
    BATTERY_LEVEL_NORMAL: LANDROID_STATUS_LOW_BATTERY.BATTERY_LEVEL_NORMAL,
  },
  // 'chargingState'
  ChargingState: {
    CHARGING: LANDROID_CHARGING_STATE.CHARGING,
    NOT_CHARGING: LANDROID_CHARGING_STATE.NOT_CHARGING,
  },
  // 'contactSensorState'
  ContactSensorState: {
    CONTACT_DETECTED: LANDROID_CONTACT_SENSOR_STATE.CONTACT_DETECTED,
    CONTACT_NOT_DETECTED: LANDROID_CONTACT_SENSOR_STATE.CONTACT_NOT_DETECTED,
  },
  Name: 'name',
  Manufacturer: 'manufacturer',
  Model: 'model',
  SerialNumber: 'serialNumber',
  StatusCode: 'status',
  StatusDescription: 'statusDescription',
  ErrorCode: 'error',
  ErrorDescription: 'errorDescription',
} as const;

type NestedCharacteristicKeyType = (typeof CharacteristicKeys)[keyof typeof CharacteristicKeys];

const PRIMARY_SERVICE = 'Primary';
const PRIMARY_CHARACTERISTIC = 'primary';
const UNKNOWN_CHARACTERISTIC = 'unknown';

class Characteristic {
  service: BaseService;
  name: string;
  value?: any;

  getter?: (callback: (_: null, value: any) => void) => any;
  setter?: (value: any, callback: any) => void;
  listeners: ((value: any) => void)[] = [];

  constructor(service: BaseService, name: string) {
    this.service = service;
    this.name = name;
  }

  on(key: 'get' | 'set', handler: () => any) {
    this[key === 'get' ? 'getter' : 'setter'] = handler;
  }

  updateValue(value: any) {
    const hasChanged = value !== this.value;
    this.value = value;
    hasChanged && this.listeners.forEach((listener) => listener(value));
  }

  async get() {
    if (!this.getter && this.value !== undefined) {
      return this.value;
    }

    if (!this.getter) {
      return undefined;
    }

    return await new Promise((resolve) =>
      this.getter((_, value) => {
        this.updateValue(value);
        resolve(value);
      })
    );
  }

  async set(value: any): Promise<void> {
    if (!this.setter) {
      return;
    }

    await new Promise((resolve) => this.setter(value, resolve));
  }

  addListener(handler?: (value: any) => void): () => void {
    this.listeners.push(handler);
    return () => this.removeListener(handler);
  }

  removeListener(handler?: (value: any) => void) {
    this.listeners = this.listeners.filter((item) => item !== handler);
  }
}

class BaseService {
  protected _name?: string;
  characteristics: { [key: string]: Characteristic } = {};

  constructor(name?: string) {
    this._name = name;
  }

  get name() {
    return this._name ?? this.constructor.name;
  }

  set name(name: string) {
    this._name = name;
  }

  private convertCharacteristicKey(key: string | NestedCharacteristicKeyType): string {
    if (typeof key === 'string') {
      return key;
    }

    if (!key) {
      return PRIMARY_CHARACTERISTIC;
    }

    if (key === CharacteristicKeys.ChargingState) {
      return 'chargingState';
    }

    if (key === CharacteristicKeys.ContactSensorState) {
      return 'contactSensorState';
    }

    return UNKNOWN_CHARACTERISTIC;
  }

  getCharacteristic(key?: string | NestedCharacteristicKeyType): Characteristic {
    key = this.convertCharacteristicKey(key);

    if (!this.characteristics[key]) {
      this.characteristics[key] = new Characteristic(this, key);
    }

    return this.characteristics[key];
  }

  setCharacteristic(key: string | NestedCharacteristicKeyType, value: any) {
    this.getCharacteristic(key).updateValue(value);
    return this;
  }

  on(key: 'get' | 'set', handler: () => any) {
    this.getCharacteristic(PRIMARY_CHARACTERISTIC).on(key, handler);
  }
}

class AccessoryInformation extends BaseService {}
class Switch extends BaseService {}
class PartySwitch extends Switch {}
class Battery extends BaseService {}
class Sensor extends BaseService {}
class ContactSensor extends Sensor {}
class ErrorSensor extends Sensor {}
class LeakSensor extends Sensor {}
class HomeSensor extends Sensor {}
class State extends BaseService {}

const Service = {
  AccessoryInformation,
  Switch,
  BatteryService: Battery,
  ContactSensor,
  ErrorSensor,
  LeakSensor,
  HomeSensor,
  PartySwitch,
  State,
} as const;

class Api {
  on(eventName: string, fn: () => Promise<void>) {
    eventName === 'didFinishLaunching' && fn();
  }

  registerPlatformAccessories() {
    isReadyResolve();
  }

  unregisterPlatformAccessories() {
    // stub
  }
}

const accessories: Accessory[] = [];

class HomebridgeAccessory {
  name: string;
  uuid: string;
  context: {
    name?: string;
    serial?: string;
  } = {};
  services: BaseService[] = [];

  constructor(name: string, uuid: string) {
    this.name = name;
    this.uuid = uuid;
  }

  static get(params?: { name?: string; uuid?: string }): Accessory | undefined {
    const { name, uuid } = params ?? Accessory.list()[0] ?? {};

    if (!name && !uuid) {
      return undefined;
    }

    if (uuid) {
      return accessories.find((item) => item.uuid === uuid && (!name || item.name === name));
    }

    return accessories.find((item) => item.name === name);
  }

  static list(): { name: string; uuid: string }[] {
    return accessories.map(({ name, uuid }) => ({ name, uuid }));
  }

  private addOrGetService(service: BaseService | typeof BaseService | string) {
    const serviceName =
      (typeof service === 'string' ? service : service.name).replace(this.name, '').trim() || PRIMARY_SERVICE;

    const registeredService = this.services.find(({ name }) => name === serviceName);
    if (registeredService) {
      return registeredService;
    }

    service =
      typeof service === 'string'
        ? new BaseService(serviceName)
        : service instanceof BaseService
        ? service
        : new service(serviceName);
    service.name = serviceName;
    this.services.push(service);

    return service;
  }

  addService(service: typeof BaseService | string) {
    this.addOrGetService(service);
  }

  getService(service: typeof BaseService | string): BaseService {
    return this.addOrGetService(service) as BaseService;
  }

  listServices(): string[] {
    return this.services.map(({ name }) => name);
  }

  listCharacteristics(): { [serviceName: string]: { [characteristicName: string]: ('get' | 'set')[] } } {
    return this.services.reduce(
      (tree, service) => ({
        ...tree,
        [service.name]: Object.keys(service.characteristics).reduce((subtree, characteristicKey) => {
          const characteristic = service.characteristics[characteristicKey];
          return {
            ...subtree,
            [characteristic.name]: [
              (characteristic.getter || characteristic.value) && 'get',
              characteristic.setter && 'set',
            ].filter(Boolean),
          };
        }, {}),
      }),
      {}
    );
  }
}

class Accessory extends HomebridgeAccessory {
  constructor(name: string, uuid: string) {
    super(name, uuid);
    accessories.push(this);
  }

  get powerState(): Promise<boolean> {
    return this.getPowerState();
  }

  getPowerState(): Promise<boolean> {
    return this.getService(PRIMARY_SERVICE).getCharacteristic(CharacteristicKeys.On).get();
  }

  set powerState(value: boolean) {
    this.setPowerState(value);
  }

  async setPowerState(value: boolean): Promise<void> {
    await this.getService(PRIMARY_SERVICE).getCharacteristic(CharacteristicKeys.On).set(value);
  }

  get batteryLevel(): Promise<number> {
    return this.getBatteryLevel();
  }

  getBatteryLevel(): Promise<number> {
    return this.getService(Service.BatteryService).getCharacteristic(CharacteristicKeys.BatteryLevel).get();
  }

  get statusLowBattery(): Promise<LANDROID_STATUS_LOW_BATTERY> {
    return this.getStatusLowBattery();
  }

  getStatusLowBattery(): Promise<LANDROID_STATUS_LOW_BATTERY> {
    return this.getService(Service.BatteryService).getCharacteristic(CharacteristicKeys.StatusLowBattery).get();
  }

  get chargingState(): Promise<LANDROID_CHARGING_STATE> {
    return this.getChargingState();
  }

  getChargingState(): Promise<LANDROID_CHARGING_STATE> {
    return this.getService(Service.BatteryService).getCharacteristic(CharacteristicKeys.ChargingState).get();
  }

  get statusCode() {
    return this.getStatusCode();
  }

  getStatusCode(): Promise<number> {
    return this.getService(Service.State).getCharacteristic(CharacteristicKeys.StatusCode).get();
  }

  onStatusCodeChange = (handler: (statusCode: number) => void): (() => void) => {
    return this.getService(Service.State).getCharacteristic(CharacteristicKeys.StatusCode).addListener(handler);
  };

  get statusDescription() {
    return this.getStatusDescription();
  }

  getStatusDescription(): Promise<string> {
    return this.getService(Service.State).getCharacteristic(CharacteristicKeys.StatusDescription).get();
  }

  get errorSensorState(): Promise<LANDROID_CONTACT_SENSOR_STATE> {
    return this.getErrorSensorState();
  }

  getErrorSensorState(): Promise<LANDROID_CONTACT_SENSOR_STATE> {
    return this.getService(Service.ErrorSensor).getCharacteristic(CharacteristicKeys.ContactSensorState).get();
  }

  get errorCode() {
    return this.getErrorCode();
  }

  getErrorCode(): Promise<number> {
    return this.getService(Service.State).getCharacteristic(CharacteristicKeys.ErrorCode).get();
  }

  onErrorCodeChange = (handler: (errorCode: number) => void): (() => void) => {
    return this.getService(Service.State).getCharacteristic(CharacteristicKeys.ErrorCode).addListener(handler);
  };

  get errorDescription() {
    return this.getErrorDescription();
  }

  getErrorDescription(): Promise<string> {
    return this.getService(Service.State).getCharacteristic(CharacteristicKeys.ErrorDescription).get();
  }

  get rainSensorState(): Promise<boolean> {
    return this.getRainSensorState();
  }

  getRainSensorState(): Promise<boolean> {
    return this.getService(Service.LeakSensor).getCharacteristic(PRIMARY_CHARACTERISTIC).get();
  }

  get homeSensorState(): Promise<LANDROID_CONTACT_SENSOR_STATE> {
    return this.getHomeSensorState();
  }

  getHomeSensorState(): Promise<LANDROID_CONTACT_SENSOR_STATE> {
    return this.getService(Service.HomeSensor).getCharacteristic(CharacteristicKeys.ContactSensorState).get();
  }

  get partyMode(): Promise<boolean> {
    return this.getPartyMode();
  }

  getPartyMode(): Promise<boolean> {
    return this.getService(Service.PartySwitch).getCharacteristic(CharacteristicKeys.On).get();
  }

  set partyMode(value: boolean) {
    this.setPartyMode(value);
  }

  async setPartyMode(value: boolean): Promise<void> {
    await this.getService(Service.PartySwitch).getCharacteristic(CharacteristicKeys.On).set(value);
  }

  get fullState(): Promise<LandroidFullState> {
    return this.getFullState();
  }

  async getFullState(): Promise<LandroidFullState> {
    return {
      statusCode: await this.statusCode,
      statusDescription: await this.statusDescription,
      power: await this.powerState,
      battery: {
        level: await this.batteryLevel,
        low: (await this.statusLowBattery) === LANDROID_STATUS_LOW_BATTERY.BATTERY_LEVEL_LOW,
        charging: (await this.chargingState) === LANDROID_CHARGING_STATE.CHARGING,
      },
      error: (await this.errorSensorState) === LANDROID_CONTACT_SENSOR_STATE.CONTACT_NOT_DETECTED,
      errorCode: await this.errorCode,
      errorDescription: await this.errorDescription,
      rain: await this.rainSensorState,
      home: (await this.homeSensorState) === LANDROID_CONTACT_SENSOR_STATE.CONTACT_DETECTED,
      party: await this.partyMode,
    };
  }

  get info(): LandroidInfo {
    return this.getInfo();
  }

  getInfo(): LandroidInfo {
    const informationService = this.getService(Service.AccessoryInformation);

    return {
      name: informationService.getCharacteristic('name').value,
      manufacturer: informationService.getCharacteristic('manufacturer').value,
      model: informationService.getCharacteristic('model').value,
      serialNumber: informationService.getCharacteristic('serialNumber').value,
    };
  }
}

const WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const ServiceRawMqtt = 'rawMqtt';
const ServiceCalendar = 'calendar';
const ServiceMower = 'mower';

const ensureLength = (num: number) => '0'.repeat(Math.max(0, 2 - String(num).length)) + String(num);

export interface MowCalendarAutoScheduleExclusionSlot {
  start: string; // format hh:mm
  end: string; // format hh:mm
  duration: number;
  reason: 'generic' | 'irrigation';
}

export interface MowCalendarAutoScheduleExclusion {
  wholeDay: boolean;
  slots: MowCalendarAutoScheduleExclusionSlot[];
}

export interface MowCalendarManualScheduleTimeSlot {
  start: string; // format hh:mm
  end: string; // format hh:mm
  effectiveEnd: string; // format hh:mm; factors in the mowTimeExtendPercentage
  duration: number; // minutes
  effectiveDuration: number; // minutes; factors in the mowTimeExtendPercentage
  borderCut: boolean;
}

export interface MowCalendar {
  autoSchedule: {
    enabled: boolean;
    boostLevel: number;
    exclusions: {
      excludeNights: boolean;
      monday: MowCalendarAutoScheduleExclusion;
      tuesday: MowCalendarAutoScheduleExclusion;
      wednesday: MowCalendarAutoScheduleExclusion;
      thursday: MowCalendarAutoScheduleExclusion;
      friday: MowCalendarAutoScheduleExclusion;
      saturday: MowCalendarAutoScheduleExclusion;
      sunday: MowCalendarAutoScheduleExclusion;
    };
  };
  manualSchedule: {
    enabled: boolean;
    times: {
      mowTimeExtendPercentage: number; // -100..100 percentage (increase/decrease)
      monday: MowCalendarManualScheduleTimeSlot[];
      tuesday: MowCalendarManualScheduleTimeSlot[];
      wednesday: MowCalendarManualScheduleTimeSlot[];
      thursday: MowCalendarManualScheduleTimeSlot[];
      friday: MowCalendarManualScheduleTimeSlot[];
      saturday: MowCalendarManualScheduleTimeSlot[];
      sunday: MowCalendarManualScheduleTimeSlot[];
    };
  };
}

class ExtendedAccessory extends Accessory {
  get calendar(): Promise<MowCalendar> {
    return this.getCalendar();
  }

  async getCalendar(): Promise<MowCalendar> {
    const raw = this.getService(ServiceRawMqtt);
    const isAutoSchedule = !!(await raw.getCharacteristic('auto_schedule').get());

    return {
      autoSchedule: {
        enabled: isAutoSchedule,
        boostLevel: ((await raw.getCharacteristic('auto_schedule_settings.boost').get()) as number) ?? 0,
        exclusions: await this.getAutoScheduleExclusions(),
      },
      manualSchedule: {
        enabled: !isAutoSchedule,
        times: await this.getManualScheduleTimes(),
      },
    };
  }

  get manualScheduleTimes(): Promise<MowCalendar['manualSchedule']['times']> {
    return this.getManualScheduleTimes();
  }

  async getManualScheduleTimes(): Promise<MowCalendar['manualSchedule']['times']> {
    const times1 = JSON.parse((await this.getService(ServiceCalendar).getCharacteristic('calJson').get()) || '[]');
    const times2 = JSON.parse((await this.getService(ServiceCalendar).getCharacteristic('calJson2').get()) || '[]');
    const mowTimeExtendPercentage =
      (await this.getService(ServiceMower).getCharacteristic('mowTimeExtend').get()) || 0;

    return new Array(7).fill(null).reduce(
      (calendar, _, weekday) => {
        const dayName = WEEK[weekday];
        const dayTimes = [times1[weekday], times2[weekday]]
          .map((slot: [string, number, number]) => {
            const [humanReadableStartTime = '00:00', duration = 0, borderCut = 0] = slot ?? [];
            const [startHour, startMinute] = humanReadableStartTime?.split(':') ?? '00:00';
            const start = parseInt(startHour, 10) * 60 + parseInt(startMinute, 10);

            return { start, startHour, startMinute, duration, borderCut };
          })
          .filter(({ duration }) => duration)
          .sort((a, b) => a.start - b.start)
          .map(({ start, startHour, startMinute, duration, borderCut }) => {
            const end = start + duration;
            const endHour = Math.floor(end / 60);
            const endMinute = end - endHour * 60;

            const effectiveDuration = Math.round(duration * (1 + mowTimeExtendPercentage / 100));
            const effectiveEnd = start + effectiveDuration;
            const effectiveEndHour = Math.floor(effectiveEnd / 60);
            const effectiveEndMinute = effectiveEnd - effectiveEndHour * 60;

            return {
              start: `${startHour}:${startMinute}`,
              end: `${ensureLength(endHour)}:${ensureLength(endMinute)}`,
              effectiveEnd: `${ensureLength(effectiveEndHour)}:${ensureLength(effectiveEndMinute)}`,
              duration,
              effectiveDuration,
              borderCut: !!borderCut,
            };
          });

        return Object.assign(calendar, { [dayName]: dayTimes });
      },
      {
        mowTimeExtendPercentage,
      }
    );
  }

  onManualScheduleTimesChange = (
    handler: (times: MowCalendar['manualSchedule']['times']) => void
  ): (() => void) => {
    const calendar = this.getService(ServiceCalendar);
    const mower = this.getService(ServiceMower);

    const characteristics: Characteristic[] = [
      calendar.getCharacteristic('calJson'),
      calendar.getCharacteristic('calJson2'),
      mower.getCharacteristic('mowTimeExtend'),
    ];

    const removeListeners = characteristics.map((characteristic) =>
      characteristic.addListener(async () => handler(await this.manualScheduleTimes))
    );

    return () => removeListeners.forEach((removeListener) => removeListener());
  };

  private async getAutoScheduleExclusions() {
    const raw = this.getService(ServiceRawMqtt);

    const data = await Promise.all(
      new Array(7).fill(null).map(async (_, weekday) => {
        const weekdayKey = `0${weekday + 1}`;
        const wholeDay = await raw
          .getCharacteristic(`auto_schedule_settings.exclusion_scheduler.days${weekdayKey}.exclude_day`)
          .get();

        let slots = await Promise.all(
          new Array(4).fill(null).map(async (_, slot) => {
            const slotKey = `0${slot + 1}`;
            return {
              start: await raw
                .getCharacteristic(
                  `auto_schedule_settings.exclusion_scheduler.days${weekdayKey}.slots${slotKey}.start_time`
                )
                .get(),
              duration: await raw
                .getCharacteristic(
                  `auto_schedule_settings.exclusion_scheduler.days${weekdayKey}.slots${slotKey}.duration`
                )
                .get(),
              reason: await raw
                .getCharacteristic(
                  `auto_schedule_settings.exclusion_scheduler.days${weekdayKey}.slots${slotKey}.reason`
                )
                .get(),
            };
          })
        );

        slots = slots
          .filter(({ duration }) => duration)
          .sort((a, b) => a.start - b.start)
          .map((item) => {
            const { start, duration } = item;
            const end = start + duration;
            const startHour = Math.floor(start / 60);
            const startMinute = start - startHour * 60;
            const endHour = Math.floor(end / 60);
            const endMinute = end - endHour * 60;

            return Object.assign(item, {
              start: `${ensureLength(startHour)}:${ensureLength(startMinute)}`,
              end: `${ensureLength(endHour)}:${ensureLength(endMinute)}`,
            });
          });

        return { wholeDay, slots };
      })
    );

    return data.reduce((exclusions, dayData, weekday) => Object.assign(exclusions, { [WEEK[weekday]]: dayData }), {
      excludeNights: !!(await raw
        .getCharacteristic('auto_schedule_settings.exclusion_scheduler.exclude_nights')
        .get()),
    } as MowCalendar['autoSchedule']['exclusions']);
  }
}

const init = async (config: LandroidConfig) => {
  const homebridgeStub = {
    platformAccessory: ExtendedAccessory,
    hap: { Service, Characteristic: CharacteristicKeys, uuid: { generate: (serial: string) => serial } },
    user: { storagePath: () => fs.dirname(require.main!.filename) },
    async registerPlatform(_: unknown, _2: unknown, LandroidPlatform: any) {
      const NO_LOG = () => {};
      landroidPlatform = new LandroidPlatform(config.debug ? console.log : NO_LOG, config, new Api());
      if (config.debug) {
        return;
      }

      const { landroidUpdate, landroidCloud } = landroidPlatform;
      const { connectMqtt, setState } = landroidCloud;
      landroidPlatform.landroidCloud.connectMqtt = (...args: any[]) => {
        landroidPlatform.landroidCloud.log.debug = null; // circumvent bug in homebridge-landroid
        connectMqtt.bind(landroidPlatform.landroidCloud)(...args);
        landroidPlatform.landroidCloud.log.debug = NO_LOG;
      };

      landroidPlatform.landroidCloud.setState = (
        key: string,
        value: { val: any } | string | number | boolean,
        ...rest: any
      ) => {
        setState.bind(landroidPlatform.landroidCloud)(key, value, ...rest);

        const [uuid, category, ...characteristic] = key?.split('.') ?? [];
        value = (value as { val: any })?.val ?? value;
        const accessory = uuid && ExtendedAccessory.get({ uuid });
        if (!accessory || !category || !characteristic.length) {
          return;
        }

        accessory.getService(category).getCharacteristic(characteristic.join('.')).updateValue(value);
      };

      landroidPlatform.landroidUpdate = (uuid: string, item: string, data: any, mowdata: any) => {
        landroidUpdate.bind(landroidPlatform)(uuid, item, data, mowdata);

        if (item !== 'status' && item !== 'error') {
          return;
        }

        const accessory = Accessory.get({ uuid });
        accessory
          ?.getService(Service.State)
          .getCharacteristic(
            item === 'status' ? CharacteristicKeys.StatusDescription : CharacteristicKeys.ErrorDescription
          )
          .updateValue(item === 'status' ? LandroidDataset.STATUS_CODES[data] : LandroidDataset.ERROR_CODES[data]);
        accessory
          ?.getService(Service.State)
          .getCharacteristic(item === 'status' ? CharacteristicKeys.StatusCode : CharacteristicKeys.ErrorCode)
          .updateValue(data);
      };
    },
  };

  homebridgeLandroid(homebridgeStub);

  await isReady;
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return ExtendedAccessory;
};

export default init;

module.exports = init;
