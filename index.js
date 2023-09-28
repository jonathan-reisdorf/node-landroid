"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LANDROID_STATUS_LOW_BATTERY = exports.LANDROID_CONTACT_SENSOR_STATE = exports.LANDROID_CHARGING_STATE = void 0;
const path_1 = __importDefault(require("path"));
const homebridge_landroid_1 = __importDefault(require("homebridge-landroid"));
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
};
const PRIMARY_SERVICE = 'Primary';
const PRIMARY_CHARACTERISTIC = 'primary';
const UNKNOWN_CHARACTERISTIC = 'unknown';
class Characteristic {
    constructor(service, name) {
        this.service = service;
        this.name = name;
    }
    on(key, handler) {
        this[key === 'get' ? 'getter' : 'setter'] = handler;
    }
    updateValue(value) {
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
    async set(value) {
        if (!this.setter) {
            return;
        }
        await new Promise((resolve) => this.setter(value, resolve));
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
const Service = {
    AccessoryInformation,
    Switch,
    BatteryService: Battery,
    ContactSensor,
    ErrorSensor,
    LeakSensor,
    HomeSensor,
    PartySwitch,
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
    landroidUpdate(...args) {
        console.log('update!!!', args);
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
    get errorSensorState() {
        return this.getErrorSensorState();
    }
    getErrorSensorState() {
        return this.getService(Service.ErrorSensor).getCharacteristic(CharacteristicKeys.ContactSensorState).get();
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
const init = async (config) => {
    const homebridgeStub = {
        platformAccessory: Accessory,
        hap: { Service, Characteristic: CharacteristicKeys, uuid: { generate: (serial) => serial } },
        user: { storagePath: () => path_1.default.dirname(require.main.filename) },
        async registerPlatform(_, _2, LandroidPlatform) {
            new LandroidPlatform(config.debug ? console.log : () => { }, config, new Api());
        },
    };
    (0, homebridge_landroid_1.default)(homebridgeStub);
    await isReady;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return Accessory;
};
exports.default = init;
module.exports = init;
