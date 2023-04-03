const test = require('tape') ;
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};
const request = require('request-promise-native').defaults({
  baseUrl: 'http://127.0.0.1:3000/v1'
});
const {
  createVoipCarrier, 
  createServiceProvider, 
  createPhoneNumber, 
  deleteObjectBySid} = require('./utils');

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

test('account tests', async(t) => {
  const app = require('../app');
  const logger = app.locals.logger;
  let sid;
  try {
    let result;

    /* add service provider, phone number, and voip carrier */
    const voip_carrier_sid = await createVoipCarrier(request);
    const service_provider_sid = await createServiceProvider(request);
    const phone_number_sid = await createPhoneNumber(request, voip_carrier_sid);
    
    /* add invite codes */
    result = await request.post('/BetaInviteCodes', {
      resolveWithFullResponse: true,
      json: true,
      auth: authAdmin,
      body: {
        count: 2
      }
    });
    t.ok(result.statusCode === 200 && 2 === parseInt(result.body.added), 'successfully added 2 beta codes');
    //console.log(result.body.codes);

    /* claim an invite code */
    /*
    const mycodes = result.body.codes;
    result = await request.post('/InviteCodes', {
      resolveWithFullResponse: true,
      json: true,
      auth: authAdmin,
      body: {
        test: true,
        code: mycodes[0]
      }
    });
    t.ok(result.statusCode === 204, 'successfully tested a beta codes');
    result = await request.post('/InviteCodes', {
      resolveWithFullResponse: true,
      json: true,
      auth: authAdmin,
      body: {
        code: mycodes[0]
      }
    });
    t.ok(result.statusCode === 204, 'successfully claimed a beta codes');
    */

    result = await request.post('/BetaInviteCodes', {
      resolveWithFullResponse: true,
      json: true,
      auth: authAdmin,
      body: {
        count: 50
      }
    });
    t.ok(result.statusCode === 200 && 50 === parseInt(result.body.added), 'successfully added 50 beta codes');

    result = await request.post('/BetaInviteCodes', {
      resolveWithFullResponse: true,
      json: true,
      auth: authAdmin,
      body: {
      }
    });
    t.ok(result.statusCode === 200 && 1 === parseInt(result.body.added), 'successfully added 1 beta codes');

    /* add an account */
    result = await request.post('/Accounts', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        name: 'daveh',
        service_provider_sid,
        registration_hook: {
          url: 'http://example.com/reg',
          method: 'get'
        },
        webhook_secret: 'foobar'
      }
    });
    t.ok(result.statusCode === 201, 'successfully created account');
    const sid = result.body.sid;

    /* query accounts for service providers */
    result = await request.get(`/ServiceProviders/${service_provider_sid}/Accounts`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
    });
    //console.log(result.body);
    t.ok(result.statusCode === 200, 'successfully queried accounts for service provider');
    
    /* add an account level api key */
    result = await request.post(`/ApiKeys`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        account_sid: sid
      }
    });
    t.ok(result.statusCode === 201 && result.body.token, 'successfully created account level token');
    const apiKeySid = result.body.sid;
    const accountLevelToken = result.body.token;
  
    /* query all account level api keys */
    result = await request.get(`/Accounts/${sid}/ApiKeys`, {
      auth: {bearer: accountLevelToken},
      json: true,
    });
    t.ok(Array.isArray(result) && result.length === 1, 'successfully queried account level keys');

    /* query all accounts */
    result = await request.get('/Accounts', {
      auth: authAdmin,
      json: true,
    });
    let regHook = result[0].registration_hook;
    t.ok(result.length === 1 &&
      Object.keys(regHook).length == 4, 'successfully queried all accounts');

    /* query one accounts */
    result = await request.get(`/Accounts/${sid}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.name === 'daveh' , 'successfully retrieved account by sid');

    /* update account with account level token */
    result = await request.put(`/Accounts/${sid}`, {
      auth: {bearer: accountLevelToken},
      json: true,
      resolveWithFullResponse: true,
      body: {
        name: 'robb',
        registration_hook: {
          url: 'http://example.com/reg2',
          method: 'get'
        },
        queue_event_hook: {
          url: 'http://example.com/q',
          method: 'post'
        }
      }
    });
    t.ok(result.statusCode === 204, 'successfully updated account using account level token');

    /* verify that account level api key last_used was updated*/
    result = await request.get(`/Accounts/${sid}/ApiKeys`, {
      auth: {bearer: accountLevelToken},
      json: true,
    });
    t.ok(typeof result[0].last_used === 'string', 'api_key last_used timestamp was updated');
    
    result = await request.get(`/Accounts/${sid}`, {
      auth: authAdmin,
      json: true,
    });
    //console.log(`retrieved account after update: ${JSON.stringify(result)}`);
    t.ok(Object.keys(result.registration_hook).length === 4, 'successfully removed a hook from account');

    /* assign phone number to account */
    result = await request.put(`/PhoneNumbers/${phone_number_sid}`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        account_sid: sid
      }
    });
    t.ok(result.statusCode === 204, 'successfully assigned phone number to account');

    /* query all limits for an account */
    result = await request.get(`/Accounts/${sid}/Limits`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.length === 0, 'successfully queried account limits when there is none configured');
    
    /* add a new limit for a account */
    result = await request.post(`/Accounts/${sid}/Limits`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        category: 'voice_call_session',
        quantity: 200
      }
    });
    t.ok(result.statusCode === 201, 'successfully added a call session limit to an account');
    
    /* update an existing limit for a account */
    result = await request.post(`/Accounts/${sid}/Limits`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        category: 'voice_call_session',
        quantity: 205
      }
    });
    t.ok(result.statusCode === 201, 'successfully updated a call session limit to an account');

    /* try to update an existing limit for an account giving a invalid sid */
    try {
      result = await request.post(`/Accounts/invalid-sid/Limits`, {
        auth: authAdmin,
        json: true,
        resolveWithFullResponse: true,
        body: {
          category: 'voice_call_session',
          quantity: 205
        }
      });
    } catch (err) {
      t.ok(err.statusCode === 400, 'returns 400 bad request if account sid param is not a valid uuid');
    }

    /* query all limits for an account */
    result = await request.get(`/Accounts/${sid}/Limits`, {
      auth: authAdmin,
      json: true,
    });
    //console.log(result);
    t.ok(result.length === 1 && result[0].quantity === 205, 'successfully queried account limits');

    /* query all limits for an account by category*/
    result = await request.get(`/Accounts/${sid}/Limits?category=voice_call_session`, {
      auth: authAdmin,
      json: true,
    });
    // console.log(result);
    t.ok(result.length === 1  && result[0].quantity === 205, 'successfully queried account limits by category');

    /* delete call session limits for a service provider */
    result = await request.delete(`/Accounts/${sid}/Limits?category=voice_call_session`, {
      auth: authAdmin,
      resolveWithFullResponse: true
    });
    t.ok(result.statusCode === 204, 'successfully deleted a call session limit for an account');

    /* delete account */
    result = await request.delete(`/Accounts/${sid}`, {
      auth: authAdmin,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully deleted account');

    await deleteObjectBySid(request, '/VoipCarriers', voip_carrier_sid);
    await deleteObjectBySid(request, '/ServiceProviders', service_provider_sid);
    //t.end();
  }
  catch (err) {
    console.error(err);
    t.end(err);
  }
});

