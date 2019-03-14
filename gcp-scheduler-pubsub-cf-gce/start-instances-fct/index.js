const Buffer = require('safe-buffer').Buffer;
const Compute = require('@google-cloud/compute');
const compute = new Compute();
/**
 * Starts a list of Compute Engine instances on a schedule. 
 * This function will be triggered by a Pub/Sub push message
 * The Pub/Sub message contains two parameters : 
 *  - "label" of instances to start 
 *  - "zone" where these instances are deployed.
 */
exports.startInstances = (event, callback) => {
    try {
        var payload = _validatePayload(JSON.parse(Buffer.from(event.data, 'base64').toString()));

        var zone = payload.zone;
        var label = payload.label;

        var options = {
            filter: "labels." + label
        };
        compute.getVMs(options).then(function(vms) {
            vms[0].forEach(function(instance) {
                if (zone == instance.zone.id) {
                    compute.zone(instance.zone.id)
                        .vm(instance.name)
                        .start()
                        .then(data => {
                            // Operation pending.
                            const operation = data[0];
                            return operation.promise();
                        })
                        .then(() => {
                            // Operation complete. Instance successfully started.
                            var message = 'Successfully started instance ' + instance.name;
                            console.log(message);
                        })
                        .catch(err => {
                            console.log(err);
                        });
                }
            });
        });
    } catch (err) {
        console.log(err);
    }
};

/**
 * Validates that a request payload contains the expected fields.
 *
 * @param {!object} payload the request payload to validate.
 * @returns {!object} the payload object.
 */
function _validatePayload(payload) {
    if (!payload.zone) {
        throw new Error(`Attribute 'zone' missing from payload`);
    } else if (!payload.label) {
        throw new Error(`Attribute 'label' missing from payload`);
    }
    return payload;
}