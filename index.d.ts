export declare enum LANDROID_CHARGING_STATE {
    CHARGING = "charging",
    NOT_CHARGING = "notCharging"
}
export declare enum LANDROID_CONTACT_SENSOR_STATE {
    CONTACT_DETECTED = "contactDetected",
    CONTACT_NOT_DETECTED = "contactNotDetected"
}
export declare enum LANDROID_STATUS_LOW_BATTERY {
    BATTERY_LEVEL_LOW = "low",
    BATTERY_LEVEL_NORMAL = "normal"
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
declare const CharacteristicKeys: {
    readonly On: "on";
    readonly BatteryLevel: "batteryLevel";
    readonly StatusLowBattery: {
        readonly BATTERY_LEVEL_LOW: LANDROID_STATUS_LOW_BATTERY.BATTERY_LEVEL_LOW;
        readonly BATTERY_LEVEL_NORMAL: LANDROID_STATUS_LOW_BATTERY.BATTERY_LEVEL_NORMAL;
    };
    readonly ChargingState: {
        readonly CHARGING: LANDROID_CHARGING_STATE.CHARGING;
        readonly NOT_CHARGING: LANDROID_CHARGING_STATE.NOT_CHARGING;
    };
    readonly ContactSensorState: {
        readonly CONTACT_DETECTED: LANDROID_CONTACT_SENSOR_STATE.CONTACT_DETECTED;
        readonly CONTACT_NOT_DETECTED: LANDROID_CONTACT_SENSOR_STATE.CONTACT_NOT_DETECTED;
    };
    readonly Name: "name";
    readonly Manufacturer: "manufacturer";
    readonly Model: "model";
    readonly SerialNumber: "serialNumber";
};
type NestedCharacteristicKeyType = (typeof CharacteristicKeys)[keyof typeof CharacteristicKeys];
declare class Characteristic {
    service: BaseService;
    name: string;
    value?: any;
    getter?: (callback: (_: null, value: any) => void) => any;
    setter?: (value: any, callback: any) => void;
    constructor(service: BaseService, name: string);
    on(key: 'get' | 'set', handler: () => any): void;
    updateValue(value: any): void;
    get(): Promise<any>;
    set(value: any): Promise<void>;
}
declare class BaseService {
    protected _name?: string;
    characteristics: {
        [key: string]: Characteristic;
    };
    constructor(name?: string);
    get name(): string;
    set name(name: string);
    private convertCharacteristicKey;
    getCharacteristic(key?: string | NestedCharacteristicKeyType): Characteristic;
    setCharacteristic(key: string | NestedCharacteristicKeyType, value: any): this;
    on(key: 'get' | 'set', handler: () => any): void;
}
declare class HomebridgeAccessory {
    name: string;
    uuid: string;
    context: {
        name?: string;
        serial?: string;
    };
    services: BaseService[];
    constructor(name: string, uuid: string);
    static get(params?: {
        name?: string;
        uuid?: string;
    }): Accessory | undefined;
    static list(): {
        name: string;
        uuid: string;
    }[];
    private addOrGetService;
    addService(service: typeof BaseService | string): void;
    getService(service: typeof BaseService | string): BaseService;
    listServices(): string[];
    listCharacteristics(): {
        [serviceName: string]: {
            [characteristicName: string]: ('get' | 'set')[];
        };
    };
}
declare class Accessory extends HomebridgeAccessory {
    constructor(name: string, uuid: string);
    get powerState(): Promise<boolean>;
    getPowerState(): Promise<boolean>;
    set powerState(value: boolean);
    setPowerState(value: boolean): Promise<void>;
    get batteryLevel(): Promise<number>;
    getBatteryLevel(): Promise<number>;
    get statusLowBattery(): Promise<LANDROID_STATUS_LOW_BATTERY>;
    getStatusLowBattery(): Promise<LANDROID_STATUS_LOW_BATTERY>;
    get chargingState(): Promise<LANDROID_CHARGING_STATE>;
    getChargingState(): Promise<LANDROID_CHARGING_STATE>;
    get errorSensorState(): Promise<LANDROID_CONTACT_SENSOR_STATE>;
    getErrorSensorState(): Promise<LANDROID_CONTACT_SENSOR_STATE>;
    get rainSensorState(): Promise<boolean>;
    getRainSensorState(): Promise<boolean>;
    get homeSensorState(): Promise<LANDROID_CONTACT_SENSOR_STATE>;
    getHomeSensorState(): Promise<LANDROID_CONTACT_SENSOR_STATE>;
    get partyMode(): Promise<boolean>;
    getPartyMode(): Promise<boolean>;
    set partyMode(value: boolean);
    setPartyMode(value: boolean): Promise<void>;
    get fullState(): Promise<LandroidFullState>;
    getFullState(): Promise<LandroidFullState>;
    get info(): LandroidInfo;
    getInfo(): LandroidInfo;
}
export interface MowCalendarAutoScheduleExclusionSlot {
    start: string;
    end: string;
    duration: number;
    reason: 'generic' | 'irrigation';
}
export interface MowCalendarAutoScheduleExclusion {
    wholeDay: boolean;
    slots: MowCalendarAutoScheduleExclusionSlot[];
}
export interface MowCalendarManualScheduleTimeSlot {
    start: string;
    end: string;
    effectiveEnd: string;
    duration: number;
    effectiveDuration: number;
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
            mowTimeExtendPercentage: number;
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
declare class ExtendedAccessory extends Accessory {
    get calendar(): Promise<MowCalendar>;
    getCalendar(): Promise<MowCalendar>;
    private getManualScheduleTimes;
    private getAutoScheduleExclusions;
}
declare const init: (config: LandroidConfig) => Promise<typeof ExtendedAccessory>;
export default init;
//# sourceMappingURL=index.d.ts.map