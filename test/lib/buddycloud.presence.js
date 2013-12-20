'use strict';

var Buddycloud = require('../../index')
  , helper  = require('../helper')
require('should')

/* jshint -W030 */
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
            jid: 'romeo@example.com',
            _getLogger: function() {
                return {
                    log: function() {},
                    info: function() {},
                    error: function() {},
                    warn: function() {}
                }
            }
        }
        buddycloud = new Buddycloud()
        buddycloud.init(manager)
    })

    afterEach(function() {
        xmpp.removeAllListeners('stanza')
        buddycloud.channelServer = 'channels.example.com'
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
            delete buddycloud.channelServer
            socket.emit('xmpp.buddycloud.presence')
        })

        it('Sends expected stanza', function(done) {
            xmpp.once('stanza', function(stanza) {
                stanza.is('presence').should.be.true
                stanza.attrs.to.should.equal(buddycloud.channelServer)
                stanza.getChildText('status').should.equal('buddycloud')
                stanza.getChildText('priority').should.equal('-1')
                stanza.getChildText('show').should.equal('online')
                done()
            })
            socket.emit('xmpp.buddycloud.presence')
        })

    })

})
