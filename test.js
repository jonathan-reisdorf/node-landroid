const landroid = require('./index');

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
