var should  = require('should')
  , Buddycloud = require('../../lib/buddycloud')
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
            },
            jid: "romeo@example.com"
        }
        buddycloud = new Buddycloud()
        buddycloud.init(manager)
    })

    afterEach(function() {
        xmpp.removeAllListeners('stanza')
    })

    describe('Presence', function() {

        it('It errors if channel server not discovered', function(done) {
            socket.once('xmpp.error.client', function(error) {
                error.should.eql({ 
                    type: 'modify',
                    condition: 'client-error',
                    description: 'You must perform discovery first!',
                    request: {}
                })
                done()
            })
            socket.emit('xmpp.buddycloud.presence')
        })
  
    })

})
