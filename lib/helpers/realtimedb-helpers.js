const logger = require('../logger');

const {
  retrieveCall,
  deleteCall,
  listCalls,
  purgeCalls,
  retrieveSet,
  addKey,
  retrieveKey,
  deleteKey,
  client: redisClient,
} = require('@jambonz/realtimedb-helpers')({
  host: process.env.JAMBONES_REDIS_HOST || 'localhost',
  port: process.env.JAMBONES_REDIS_PORT || 6379
}, logger);

module.exports = {
  retrieveCall,
  deleteCall,
  listCalls,
  purgeCalls,
  retrieveSet,
  addKey,
  retrieveKey,
  deleteKey,
  redisClient,
};
