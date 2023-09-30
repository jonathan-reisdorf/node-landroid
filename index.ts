import fs from 'path';
import homebridgeLandroid from 'homebridge-landroid';

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
  power: boolean;
  battery: {
    level: number;
    low: boolean;
    charging: boolean;
  };
  error: boolean;
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

  constructor(service: BaseService, name: string) {
    this.service = service;
    this.name = name;
  }

  on(key: 'get' | 'set', handler: () => any) {
    this[key === 'get' ? 'getter' : 'setter'] = handler;
  }

  updateValue(value: any) {
    this.value = value;
  }

  async get() {
    if (!this.getter && this.value !== undefined) {
      return this.value;
    }

    if (!this.getter) {
      return undefined;
    }

    return await new Promise((resolve) => this.getter((_, value) => resolve(value)));
  }

  async set(value: any): Promise<void> {
    if (!this.setter) {
      return;
    }

    await new Promise((resolve) => this.setter(value, resolve));
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

const Service = {
  AccessoryInformation,
  Switch,
  BatteryService: Battery,
  ContactSensor,
  ErrorSensor,
  LeakSensor,
  HomeSensor,
  PartySwitch,
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

  get errorSensorState(): Promise<LANDROID_CONTACT_SENSOR_STATE> {
    return this.getErrorSensorState();
  }

  getErrorSensorState(): Promise<LANDROID_CONTACT_SENSOR_STATE> {
    return this.getService(Service.ErrorSensor).getCharacteristic(CharacteristicKeys.ContactSensorState).get();
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
      power: await this.powerState,
      battery: {
        level: await this.batteryLevel,
        low: (await this.statusLowBattery) === LANDROID_STATUS_LOW_BATTERY.BATTERY_LEVEL_LOW,
        charging: (await this.chargingState) === LANDROID_CHARGING_STATE.CHARGING,
      },
      error: (await this.errorSensorState) === LANDROID_CONTACT_SENSOR_STATE.CONTACT_NOT_DETECTED,
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

const init = async (config: LandroidConfig) => {
  const homebridgeStub = {
    platformAccessory: Accessory,
    hap: { Service, Characteristic: CharacteristicKeys, uuid: { generate: (serial: string) => serial } },
    user: { storagePath: () => fs.dirname(require.main!.filename) },
    async registerPlatform(_: unknown, _2: unknown, LandroidPlatform: any) {
      const NO_LOG = () => {};
      landroidPlatform = new LandroidPlatform(config.debug ? console.log : NO_LOG, config, new Api());
      if (config.debug) {
        return;
      }

      const { connectMqtt, setState } = landroidPlatform.landroidCloud;
      landroidPlatform.landroidCloud.connectMqtt = (...args: any[]) => {
        landroidPlatform.landroidCloud.log.debug = null; // circumvent bug in homebridge-landroid
        connectMqtt.bind(landroidPlatform.landroidCloud)(...args);
        landroidPlatform.landroidCloud.log.debug = NO_LOG;
      };

      landroidPlatform.landroidCloud.setState = (key: string, valueObj: { val: any }, ...rest: any) => {
        setState.bind(landroidPlatform.landroidCloud)(key, valueObj, ...rest);

        const [uuid, category, ...characteristic] = key?.split('.') ?? [];
        const value = valueObj?.val;
        const accessory = uuid && Accessory.get({ uuid });
        if (!accessory || !category || category === 'rawMqtt' || !characteristic.length || value === undefined) {
          return;
        }

        accessory.getService(category).getCharacteristic(characteristic.join('.')).updateValue(value);
        console.log({ category, characteristic, value });
      };

      // console.log(landroidPlatform.landroidCloud);
    },
  };

  homebridgeLandroid(homebridgeStub);

  await isReady;
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return Accessory;
};

export default init;

module.exports = init;
