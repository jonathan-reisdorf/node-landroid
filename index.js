"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LANDROID_STATUS_LOW_BATTERY = exports.LANDROID_CONTACT_SENSOR_STATE = exports.LANDROID_CHARGING_STATE = void 0;
const path_1 = __importDefault(require("path"));
const homebridge_landroid_1 = __importDefault(require("homebridge-landroid"));
const LandroidDataset_1 = __importDefault(require("homebridge-landroid/LandroidDataset"));
var LANDROID_CHARGING_STATE;
(function (LANDROID_CHARGING_STATE) {
    LANDROID_CHARGING_STATE["CHARGING"] = "charging";
    LANDROID_CHARGING_STATE["NOT_CHARGING"] = "notCharging";
})(LANDROID_CHARGING_STATE || (exports.LANDROID_CHARGING_STATE = LANDROID_CHARGING_STATE = {}));
var LANDROID_CONTACT_SENSOR_STATE;
(function (LANDROID_CONTACT_SENSOR_STATE) {
    LANDROID_CONTACT_SENSOR_STATE["CONTACT_DETECTED"] = "contactDetected";
    LANDROID_CONTACT_SENSOR_STATE["CONTACT_NOT_DETECTED"] = "contactNotDetected";
})(LANDROID_CONTACT_SENSOR_STATE || (exports.LANDROID_CONTACT_SENSOR_STATE = LANDROID_CONTACT_SENSOR_STATE = {}));
var LANDROID_STATUS_LOW_BATTERY;
(function (LANDROID_STATUS_LOW_BATTERY) {
    LANDROID_STATUS_LOW_BATTERY["BATTERY_LEVEL_LOW"] = "low";
    LANDROID_STATUS_LOW_BATTERY["BATTERY_LEVEL_NORMAL"] = "normal";
})(LANDROID_STATUS_LOW_BATTERY || (exports.LANDROID_STATUS_LOW_BATTERY = LANDROID_STATUS_LOW_BATTERY = {}));
let isReadyResolve;
const isReady = new Promise((resolve) => (isReadyResolve = resolve));
let landroidPlatform;
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
};
const PRIMARY_SERVICE = 'Primary';
const PRIMARY_CHARACTERISTIC = 'primary';
const UNKNOWN_CHARACTERISTIC = 'unknown';
class Characteristic {
    constructor(service, name) {
        this.listeners = [];
        this.service = service;
        this.name = name;
    }
    on(key, handler) {
        this[key === 'get' ? 'getter' : 'setter'] = handler;
    }
    updateValue(value) {
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
        return await new Promise((resolve) => this.getter((_, value) => {
            this.updateValue(value);
            resolve(value);
        }));
    }
    async set(value) {
        if (!this.setter) {
            return;
        }
        await new Promise((resolve) => this.setter(value, resolve));
    }
    addListener(handler) {
        this.listeners.push(handler);
        return () => this.removeListener(handler);
    }
    removeListener(handler) {
        this.listeners = this.listeners.filter((item) => item !== handler);
    }
}
class BaseService {
    constructor(name) {
        this.characteristics = {};
        this._name = name;
    }
    get name() {
        return this._name ?? this.constructor.name;
    }
    set name(name) {
        this._name = name;
    }
    convertCharacteristicKey(key) {
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
    getCharacteristic(key) {
        key = this.convertCharacteristicKey(key);
        if (!this.characteristics[key]) {
            this.characteristics[key] = new Characteristic(this, key);
        }
        return this.characteristics[key];
    }
    setCharacteristic(key, value) {
        this.getCharacteristic(key).updateValue(value);
        return this;
    }
    on(key, handler) {
        this.getCharacteristic(PRIMARY_CHARACTERISTIC).on(key, handler);
    }
}
class AccessoryInformation extends BaseService {
}
class Switch extends BaseService {
}
class PartySwitch extends Switch {
}
class Battery extends BaseService {
}
class Sensor extends BaseService {
}
class ContactSensor extends Sensor {
}
class ErrorSensor extends Sensor {
}
class LeakSensor extends Sensor {
}
class HomeSensor extends Sensor {
}
class State extends BaseService {
}
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
};
class Api {
    on(eventName, fn) {
        eventName === 'didFinishLaunching' && fn();
    }
    registerPlatformAccessories() {
        isReadyResolve();
    }
    unregisterPlatformAccessories() {
        // stub
    }
}
const accessories = [];
class HomebridgeAccessory {
    constructor(name, uuid) {
        this.context = {};
        this.services = [];
        this.name = name;
        this.uuid = uuid;
    }
    static get(params) {
        const { name, uuid } = params ?? Accessory.list()[0] ?? {};
        if (!name && !uuid) {
            return undefined;
        }
        if (uuid) {
            return accessories.find((item) => item.uuid === uuid && (!name || item.name === name));
        }
        return accessories.find((item) => item.name === name);
    }
    static list() {
        return accessories.map(({ name, uuid }) => ({ name, uuid }));
    }
    addOrGetService(service) {
        const serviceName = (typeof service === 'string' ? service : service.name).replace(this.name, '').trim() || PRIMARY_SERVICE;
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
    addService(service) {
        this.addOrGetService(service);
    }
    getService(service) {
        return this.addOrGetService(service);
    }
    listServices() {
        return this.services.map(({ name }) => name);
    }
    listCharacteristics() {
        return this.services.reduce((tree, service) => ({
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
        }), {});
    }
}
class Accessory extends HomebridgeAccessory {
    constructor(name, uuid) {
        super(name, uuid);
        this.onStatusCodeChange = (handler) => {
            return this.getService(Service.State).getCharacteristic(CharacteristicKeys.StatusCode).addListener(handler);
        };
        this.onErrorCodeChange = (handler) => {
            return this.getService(Service.State).getCharacteristic(CharacteristicKeys.ErrorCode).addListener(handler);
        };
        accessories.push(this);
    }
    get powerState() {
        return this.getPowerState();
    }
    getPowerState() {
        return this.getService(PRIMARY_SERVICE).getCharacteristic(CharacteristicKeys.On).get();
    }
    set powerState(value) {
        this.setPowerState(value);
    }
    async setPowerState(value) {
        await this.getService(PRIMARY_SERVICE).getCharacteristic(CharacteristicKeys.On).set(value);
    }
    get batteryLevel() {
        return this.getBatteryLevel();
    }
    getBatteryLevel() {
        return this.getService(Service.BatteryService).getCharacteristic(CharacteristicKeys.BatteryLevel).get();
    }
    get statusLowBattery() {
        return this.getStatusLowBattery();
    }
    getStatusLowBattery() {
        return this.getService(Service.BatteryService).getCharacteristic(CharacteristicKeys.StatusLowBattery).get();
    }
    get chargingState() {
        return this.getChargingState();
    }
    getChargingState() {
        return this.getService(Service.BatteryService).getCharacteristic(CharacteristicKeys.ChargingState).get();
    }
    get statusCode() {
        return this.getStatusCode();
    }
    getStatusCode() {
        return this.getService(Service.State).getCharacteristic(CharacteristicKeys.StatusCode).get();
    }
    get statusDescription() {
        return this.getStatusDescription();
    }
    getStatusDescription() {
        return this.getService(Service.State).getCharacteristic(CharacteristicKeys.StatusDescription).get();
    }
    get errorSensorState() {
        return this.getErrorSensorState();
    }
    getErrorSensorState() {
        return this.getService(Service.ErrorSensor).getCharacteristic(CharacteristicKeys.ContactSensorState).get();
    }
    get errorCode() {
        return this.getErrorCode();
    }
    getErrorCode() {
        return this.getService(Service.State).getCharacteristic(CharacteristicKeys.ErrorCode).get();
    }
    get errorDescription() {
        return this.getErrorDescription();
    }
    getErrorDescription() {
        return this.getService(Service.State).getCharacteristic(CharacteristicKeys.ErrorDescription).get();
    }
    get rainSensorState() {
        return this.getRainSensorState();
    }
    getRainSensorState() {
        return this.getService(Service.LeakSensor).getCharacteristic(PRIMARY_CHARACTERISTIC).get();
    }
    get homeSensorState() {
        return this.getHomeSensorState();
    }
    getHomeSensorState() {
        return this.getService(Service.HomeSensor).getCharacteristic(CharacteristicKeys.ContactSensorState).get();
    }
    get partyMode() {
        return this.getPartyMode();
    }
    getPartyMode() {
        return this.getService(Service.PartySwitch).getCharacteristic(CharacteristicKeys.On).get();
    }
    set partyMode(value) {
        this.setPartyMode(value);
    }
    async setPartyMode(value) {
        await this.getService(Service.PartySwitch).getCharacteristic(CharacteristicKeys.On).set(value);
    }
    get fullState() {
        return this.getFullState();
    }
    async getFullState() {
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
    get info() {
        return this.getInfo();
    }
    getInfo() {
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
const ensureLength = (num) => '0'.repeat(Math.max(0, 2 - String(num).length)) + String(num);
class ExtendedAccessory extends Accessory {
    constructor() {
        super(...arguments);
        this.onManualScheduleTimesChange = (handler) => {
            const calendar = this.getService(ServiceCalendar);
            const mower = this.getService(ServiceMower);
            const characteristics = [
                calendar.getCharacteristic('calJson'),
                calendar.getCharacteristic('calJson2'),
                mower.getCharacteristic('mowTimeExtend'),
            ];
            const removeListeners = characteristics.map((characteristic) => characteristic.addListener(async () => handler(await this.manualScheduleTimes)));
            return () => removeListeners.forEach((removeListener) => removeListener());
        };
    }
    get calendar() {
        return this.getCalendar();
    }
    async getCalendar() {
        const raw = this.getService(ServiceRawMqtt);
        const isAutoSchedule = !!(await raw.getCharacteristic('auto_schedule').get());
        return {
            autoSchedule: {
                enabled: isAutoSchedule,
                boostLevel: (await raw.getCharacteristic('auto_schedule_settings.boost').get()) ?? 0,
                exclusions: await this.getAutoScheduleExclusions(),
            },
            manualSchedule: {
                enabled: !isAutoSchedule,
                times: await this.getManualScheduleTimes(),
            },
        };
    }
    get manualScheduleTimes() {
        return this.getManualScheduleTimes();
    }
    async getManualScheduleTimes() {
        const times1 = JSON.parse((await this.getService(ServiceCalendar).getCharacteristic('calJson').get()) || '[]');
        const times2 = JSON.parse((await this.getService(ServiceCalendar).getCharacteristic('calJson2').get()) || '[]');
        const mowTimeExtendPercentage = (await this.getService(ServiceMower).getCharacteristic('mowTimeExtend').get()) || 0;
        return new Array(7).fill(null).reduce((calendar, _, weekday) => {
            const dayName = WEEK[weekday];
            const dayTimes = [times1[weekday], times2[weekday]]
                .map((slot) => {
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
        }, {
            mowTimeExtendPercentage,
        });
    }
    async getAutoScheduleExclusions() {
        const raw = this.getService(ServiceRawMqtt);
        const data = await Promise.all(new Array(7).fill(null).map(async (_, weekday) => {
            const weekdayKey = `0${weekday + 1}`;
            const wholeDay = await raw
                .getCharacteristic(`auto_schedule_settings.exclusion_scheduler.days${weekdayKey}.exclude_day`)
                .get();
            let slots = await Promise.all(new Array(4).fill(null).map(async (_, slot) => {
                const slotKey = `0${slot + 1}`;
                return {
                    start: await raw
                        .getCharacteristic(`auto_schedule_settings.exclusion_scheduler.days${weekdayKey}.slots${slotKey}.start_time`)
                        .get(),
                    duration: await raw
                        .getCharacteristic(`auto_schedule_settings.exclusion_scheduler.days${weekdayKey}.slots${slotKey}.duration`)
                        .get(),
                    reason: await raw
                        .getCharacteristic(`auto_schedule_settings.exclusion_scheduler.days${weekdayKey}.slots${slotKey}.reason`)
                        .get(),
                };
            }));
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
        }));
        return data.reduce((exclusions, dayData, weekday) => Object.assign(exclusions, { [WEEK[weekday]]: dayData }), {
            excludeNights: !!(await raw
                .getCharacteristic('auto_schedule_settings.exclusion_scheduler.exclude_nights')
                .get()),
        });
    }
}
const init = async (config) => {
    const homebridgeStub = {
        platformAccessory: ExtendedAccessory,
        hap: { Service, Characteristic: CharacteristicKeys, uuid: { generate: (serial) => serial } },
        user: { storagePath: () => path_1.default.dirname(require.main.filename) },
        async registerPlatform(_, _2, LandroidPlatform) {
            const NO_LOG = () => { };
            landroidPlatform = new LandroidPlatform(config.debug ? console.log : NO_LOG, config, new Api());
            if (config.debug) {
                return;
            }
            const { landroidUpdate, landroidCloud } = landroidPlatform;
            const { connectMqtt, setState } = landroidCloud;
            landroidPlatform.landroidCloud.connectMqtt = (...args) => {
                landroidPlatform.landroidCloud.log.debug = null; // circumvent bug in homebridge-landroid
                connectMqtt.bind(landroidPlatform.landroidCloud)(...args);
                landroidPlatform.landroidCloud.log.debug = NO_LOG;
            };
            landroidPlatform.landroidCloud.setState = (key, value, ...rest) => {
                setState.bind(landroidPlatform.landroidCloud)(key, value, ...rest);
                const [uuid, category, ...characteristic] = key?.split('.') ?? [];
                value = value?.val ?? value;
                const accessory = uuid && ExtendedAccessory.get({ uuid });
                if (!accessory || !category || !characteristic.length) {
                    return;
                }
                accessory.getService(category).getCharacteristic(characteristic.join('.')).updateValue(value);
            };
            landroidPlatform.landroidUpdate = (uuid, item, data, mowdata) => {
                landroidUpdate.bind(landroidPlatform)(uuid, item, data, mowdata);
                if (item !== 'status' && item !== 'error') {
                    return;
                }
                const accessory = Accessory.get({ uuid });
                accessory
                    ?.getService(Service.State)
                    .getCharacteristic(item === 'status' ? CharacteristicKeys.StatusDescription : CharacteristicKeys.ErrorDescription)
                    .updateValue(item === 'status' ? LandroidDataset_1.default.STATUS_CODES[data] : LandroidDataset_1.default.ERROR_CODES[data]);
                accessory
                    ?.getService(Service.State)
                    .getCharacteristic(item === 'status' ? CharacteristicKeys.StatusCode : CharacteristicKeys.ErrorCode)
                    .updateValue(data);
            };
        },
    };
    (0, homebridge_landroid_1.default)(homebridgeStub);
    await isReady;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return ExtendedAccessory;
};
exports.default = init;
module.exports = init;
