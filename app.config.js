const baseConfig = require('./app.json').expo;

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

module.exports = {
  ...baseConfig,
  android: {
    ...baseConfig.android,
    ...(googleMapsApiKey
      ? {
          config: {
            ...baseConfig.android.config,
            googleMaps: {
              apiKey: googleMapsApiKey,
            },
          },
        }
      : {}),
  },
};
