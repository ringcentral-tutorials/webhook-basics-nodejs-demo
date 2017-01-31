'use strict';

// Load local environment variables
if('production' !== process.env.RC_ENV ) require('dotenv').load();

// Dependencies
const RC = require('ringcentral');
const http = require('http');
const url = require('url');

var server = http.createServer();

// Instantiate RC-SDK
var rcsdk = new RC({
    server: process.env.RC_SERVER,
    appKey: process.env.RC_APP_KEY,
    appSecret: process.env.RC_APP_SECRET
});

var platform = rcsdk.platform();
//var subscription = rcsdk.createSubscription();
var subscription;


platform
    .login({
        username: process.env.RC_USERNAME,
        password: process.env.RC_PASSWORD,
        extension: process.env.RC_EXTENSION
    })
    .then(function(authResponse) {
        //console.log('RC authResponse: ', authResponse.json());
        init();
    })
    .catch(function(e) {
        console.error(e);
        throw e;
    });

// Create Webhook/Subscription
function startSubscription(eventFilterPayload) {
    console.log('Event Filter Payload: ', eventFilterPayload);
    return platform.post('/subscription',
        {
            eventFilters: eventFilterPayload,
            /* referenced by developer in community post: https://devcommunity.ringcentral.com/ringcentraldev/topics/after-successfully-making-a-new-subscription-there-is-no-webhook-posted-while-the-ringout-call-is-in-progress
            eventFilters: [
                '/restapi/v1.0/account/~/extension',
                '/restapi/v1.0/account/~/extension/~/presence?detailedTelephonyState=true&sipData=true',
                '/restapi/v1.0/account/~/extension/~/presence/line/presence?detailedTelephonyState=true'
            ],
            */
            deliveryMode: {
                transportType: process.env.DELIVERY_MODE_TRANSPORT_TYPE,
                //address: process.env.DELIVERY_MODE_ADDRESS + '?auth_token=' + process.env.WEBHOOK_TOKEN
                address: process.env.DELIVERY_MODE_ADDRESS
            }
        })
        .then(function(subscriptionResponse) {
            console.log('Subscription Response: ', subscriptionResponse.json());
            subscription = subscriptionResponse;
        })
        .catch(function(e) {
            console.error(e);
            throw e;
        });
}

function init() {
    var extensions = [];
    var page = 1;

    function getExtensionsPage() {

        return platform
            .get('/account/~/extension/', {
                type: 'User',
                status: 'Enabled',
                page: page,
                perPage: process.env.EXTENSIONS_PER_PAGE //REDUCE NUMBER TO SPEED BOOTSTRAPPING
            })
            .then(function (response) {
                //console.log("The extension response contained:", JSON.stringify(response.json(), null, 2));
                var data = response.json();
                //console.log("************** THE NUMBER OF EXTENSIONS ARE : ***************", data.records.length);
                extensions = extensions.concat(data.records);
                if (data.navigation.nextPage) {
                    page++;
                    return getExtensionsPage(); // this will be chained
                } else {
                    return extensions; // this is the finally resolved thing
                }
            });

    }

    /*
     Loop until you capture all extensions
     */
    return getExtensionsPage()
        .then(createEventFilter)
        .then(startSubscription)
        .catch(function (e) {
            console.error(e);
            throw e;
        });

}

function createEventFilter(extensions) {
    //console.log("********* CREATING EVENT FILTERS ***************");
    var _eventFilters = [];
    for(var i = 0; i < extensions.length; i++) {
        var extension = extensions[i];
        //console.log('EXTENSION: ', extension);
        _eventFilters.push(generatePresenceEventFilter(extension));
        _eventFilters.push(generateInstantMessageEventFilter(extension));
    }
    //console.log('EVENT FILTERS: ', _eventFilters);
    return _eventFilters;
}

function generatePresenceEventFilter(item) {
    //console.log("The item is :", item);
    if (!item) {
        throw new Error('generatePresenceEventFilter requires an extension');
    } else {
        console.log("The Presence Filter added for the extension :" + item.id + ' : /account/~/extension/' + item.id + '/presence?detailedTelephonyState=true&aggregated=true');
        return '/restapi/v1.0/account/~/extension/' + item.id + '/presence?detailedTelephonyState=true&aggregated=true';
    }
}

function generateInstantMessageEventFilter(item) {
    //console.log("The item is :", item);
    if (!item) {
        throw new Error('generateInstantMessageEventFilter requires an extension');
    } else {
        console.log("The Instant Message Event Filter added for the extension :" + item.id + ' : /account/~/extension/' + item.id + '/message-store/instant?type=SMS');
        return '/restapi/v1.0/account/~/extension/' + item.id + '/message-store/instant?type=SMS';
    }
}



// Register Platform Event Listeners
platform.on(platform.events.loginSuccess, handleLoginSuccess);
platform.on(platform.events.loginError, handleLoginError);
platform.on(platform.events.logoutSuccess, handleLogoutSuccess);
platform.on(platform.events.logoutError, handleLogoutError);
platform.on(platform.events.refreshSuccess, handleRefreshSuccess);
platform.on(platform.events.refreshError, handleRefreshError);

// Register Subscription Event Listeners
/*
subscription.on(subscription.events.notification, handleSubscriptionNotification);
subscription.on(subscription.events.removeSuccess, handleRemoveSubscriptionSuccess);
subscription.on(subscription.events.removeError, handleRemoveSubscriptionError);
subscription.on(subscription.events.renewSuccess, handleSubscriptionRenewSuccess);
subscription.on(subscription.events.renewError, handleSubscriptionRenewError);
subscription.on(subscription.events.subscribeSuccess, handleSubscribeSuccess);
subscription.on(subscription.events.subscribeError, handleSubscribeError);
*/

// Define Event Handlers
function handleSubscriptionNotification(msg) {
    console.log('SUBSCRIPTION NOTIFICATION.....');
    console.log(util.inspect(msg, {showHidden: true, depth: null}));
}

function handleRemoveSubscriptionSuccess(data) {
    console.log('REMOVE SUBSCRIPTION SUCCESS DATA: ', data);
}

function handleRemoveSubscriptionError(data) {
    console.log('REMOVE SUBSCRIPTION ERROR DATA: ', data);
}

function handleSubscriptionRenewSuccess(data) {
    console.log('RENEW SUBSCRIPTION SUCCESS DATA: ', data);
}

function handleSubscriptionRenewError(data) {
    console.log('RENEW SUBSCRIPTION ERROR DATA: ', data);
}

function handleSubscribeSuccess(data) {
    console.log('SUBSCRIPTION CREATED SUCCESSFULLY');
}

function handleSubscribeError(data) {
    console.log('FAILED TO CREATE SUBSCRIPTION: ', data);
}

/**
 * Platform Event Handlers
 **/
function handleLoginSuccess(data) {
    // UNCOMMENT TO VIEW LOGIN DATA
    console.log('LOGIN SUCCESS DATA: ', data.json());
}

function handleLoginError(data) {
    console.log('LOGIN FAILURE DATA: ', data);
}

function handleLogoutSuccess(data) {
    console.log('LOGOUT SUCCESS DATA: ', data);
}

function handleLogoutError(data) {
    console.log('LOGOUT FAILURE DATA: ', data);
}

function handleRefreshSuccess(data) {
    console.log('REFRESH SUCCESS DATA: ', data);
}

function handleRefreshError(data) {
    console.log('REFRESH FAILURE DATA: ', data);
    console.log('Initialing Login again :');
    login();
}

console.log('PORT: ', process.env.PORT);
server.listen(process.env.PORT);
server.on('listening', function() {
    console.log('Server is listening on port: ', process.env.PORT);
});
server.on('close', function() {
    console.log('Server has closed and is no longer accepting connections');
});
server.on('error', function(err) {
    console.error(err);
});
server.on('request', inboundRequest);

function inboundRequest(req, res) {
    var method = req.method;
    var reqUrl = req.url;
    var queryData = url.parse(reqUrl, true).query;
    var headers = req.headers;
    var validationToken = headers['validation-token'];
    var signature = queryData.signature;
    var body = [];

    // Reject stuff we do not want
    //if( 'POST' != method || '/webhooks?auth_token=ShouldBeASecureToken12344321' != reqUrl ) {
    console.log('inboundRequest Received...');
    console.log('REQUEST: ', req);
    if( 'POST' != method || '/webhooks' != reqUrl) {
        console.log( 'NOT POST -or- URL DOES NOT MATCH' );
        res.statusCode = 403; // Forbidden
        res.end();
    } else {
        console.log( 'POST AND TOKEN MATCH, CONTINUING...' );
        // Validation Token should only ever be presented while setting up the webhook (or perhaps while refreshing, need to confirm)
        if(validationToken) {
            res.setHeader('Validation-Token', validationToken);
            res.statusCode = 200;
            res.end();
        } else {
            req.on('data', function(chunk) {
                body.push(chunk);
            }).on('end', function() {
                body = Buffer.concat(body).toString();
                console.log('BODY: ', body);
                res.statusCode = 200;
                res.end(body);
            });
        }
    }
}
