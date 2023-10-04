# node-landroid

Small wrapper around [homebridge-landroid](https://github.com/normen/homebridge-landroid) to use in plain nodejs projects, without Homebridge.

## Installation

In your project folder, run:

```sh
npm install --save node-landroid
```

## Example (periodically poll state from single mower)

```js
const landroid = require('node-landroid');

const config = {
  partymode: true,
  debug: false,
  mowdata: true,
  rainsensor: true,
  homesensor: true,
  email: 'your-email-address',
  pwd: 'your-password',
}; // better read this from a gitignored config.json, environment variables or .env file!

const update = async (Accessory) => {
  console.log(`Update from ${new Date().toISOString()}:`, await Accessory.get().fullState, '\n');
  setTimeout(() => update(Accessory), 10000);
};

(async () => {
  const Accessory = await landroid(config);
  update(Accessory);
})();
```

## Interface

`node-landroid` is asynchronous. Once initializing with `await landroid(config)`, you get back a reference to an `Accessory` class.

To get a list of your mowers, run this code:

```js
Accessory.list();
```

which returns a `{ name: string; uuid: string }` array. Those you can use as parameters to access a single mower.

To access a single mower, either run

```js
Accessory.get();
```

which gives you the first mower (useful if you only have one), or

```js
Accessory.get({ name: 'Test' }); // get mower with name "Test"
Accessory.get({ uuid: 'abcd' }); // get mower with uuid "abcd"
Accessory.get({ name: 'Test', uuid: 'abcd' }); // get mower with name "Test" AND uuid "abcd"
```

The `Accessory` instance has the following getters and setters:

```js
const accessory = Accessory.get();

await accessory.powerState; // true: mower is running, false: mower is returning home or idle
await accessory.statusCode; // number
await accessory.statusDescription; // string (human-readable status)
await accessory.batteryLevel; // percentage, number from 0 to 100
await accessory.statusLowBattery; // "low" when battery is low, else "normal"
await accessory.chargingState; // "charging" when charging, "notCharging" when not
await accessory.errorSensorState; // "contactDetected" when no error, "contactNotDetected" when error
await accessory.errorCode; // number
await accessory.errorDescription; // string (human-readable error)
await accessory.rainSensorState; // true: rain sensor detects water, false: no water
await accessory.homeSensorState; // "contactDetected" when mower is home, "contactNotDetected" when mower is not home
await accessory.partyMode; // true: party mode on, false: party mode off
await accessory.fullState; // returns an object with everything at once and the string states are converted to boolean
await accessory.calendar; // returns the automatic/manual mowing settings/schedule
await accessory.manualScheduleTimes; // returns the manual mowing schedule (only)
accessory.info; // returns info about the mower

accessory.powerState = true; // start the mower
accessory.powerState = false; // stop the mower
accessory.partyMode = true; // enable party mode
accessory.partyMode = false; // disable party mode
```

There are also normal methods available for every of those getters/setters, e.g. `getPowerState()` or `setPowerState(value)` which allows to `await` also setting the values.
For `accessory.calendar`, see the `MowCalendar` interface. For `accessory.fullState`, see the `LandroidFullState` interface.

## Real-time updates

For some getters (more will follow), there is also a method to listen for changes (in real-time). It may be a good idea to still also poll the values from time to time as the MQTT connection may be lost while a change happens.

Example:

```js
const Accessory = await landroid(config);
const accessory = Accessory.get();

console.log('Mowing schedule:', await accessory.manualScheduleTimes);
accessory.onManualScheduleTimesChange((times) => console.log('New mowing schedule:', times));

console.log('Status:', {
  statusCode: await accessory.statusCode,
  statusDescription: await accessory.statusDescription,
});
accessory.onStatusCodeChange(async (statusCode) =>
  console.log('Changed status:', {
    statusCode,
    statusDescription: await accessory.statusDescription,
  })
);

console.log('Error state:', {
  errorCode: await accessory.errorCode,
  errorDescription: await accessory.errorDescription,
});
accessory.onErrorCodeChange(async (errorCode) =>
  console.log('Changed error state:', {
    errorCode,
    errorDescription: await accessory.errorDescription,
  })
);
```

The return value of these `onChange` methods is a function which when called removes the listener.

## Roadmap

It would be nice to be able to use this as MQTT standalone package. Also, more setters will be added as I need them for my personal projects.

## Why homebridge-landroid and not ioBroker.worx?

`homebridge-landroid` uses code from `ioBroker.worx`, however it also adds a few small hacks and an adapter which makes it more accessible.

## Disclaimers

This is a very early and MVP version to get things going. I don't know the first thing about Homebridge, ioBroker or the Worx APIs, so I just "reverse-engineered" `homebridge-landroid` instead. Some of the code style decisions are just inherited from this library and features may be missing or work in a different way than expected. In those cases, feel free to raise an issue or PR. :)
