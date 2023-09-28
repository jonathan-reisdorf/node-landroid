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
await accessory.batteryLevel; // percentage, number from 0 to 100
await accessory.statusLowBattery; // "low" when battery is low, else "normal"
await accessory.chargingState; // "charging" when charging, "notCharging" when not
await accessory.errorSensorState; // "contactDetected" when no error, "contactNotDetected" when wire not found
await accessory.rainSensorState; // true: rain sensor detects water, false: no water
await accessory.homeSensorState; // "contactDetected" when mower is home, "contactNotDetected" when mower is not home
await accessory.partyMode; // true: party mode on, false: party mode off
await accessory.fullState; // returns an object with everything at once and the string states are converted to boolean
accessory.info; // returns info about the mower
```

## Roadmap

Since `homebridge-landroid` connects to Worx via MQTT, it would be nice to add MQTT support as well and offer the option to use this as standalone package as then we'd get realtime updates instead of having to poll the values.

## Disclaimers

This is a very early and MVP version to get things going. I don't know the first thing about Homebridge or the Worx APIs, so I just "reverse-engineered" `homebridge-landroid` instead. Some features may be missing or work in a different way than expected. In those cases, feel free to raise an issue or PR. :)
