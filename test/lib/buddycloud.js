var should  = require('should')
  , buddycloud = require('../../lib/buddycloud')
  , ltx     = require('ltx')
  , helper  = require('../helper')

describe('buddycloud', function() {

    var buddycloud, socket, xmpp, manager

    before(function() {
        socket = new helper.Eventer()
        xmpp = new helper.Eventer()
        manager = {
            socket: socket,
            client: xmpp,
            trackId: function(id, callback) {
                this.callback = callback
            },
            makeCallback: function(error, data) {
                this.callback(error, data)
            }
        }
        buddycloud = new buddycloud()
        buddycloud.init(manager)
    })

})
