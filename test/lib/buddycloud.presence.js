'use strict';

var Buddycloud = require('../../index')
  , helper  = require('../helper')
require('should')

/* jshint -W030 */
describe('buddycloud', function() {

    var buddycloud, socket, xmpp, manager

    before(function() {
        socket = new helper.SocketEventer()
        xmpp = new helper.XmppEventer()
        manager = {
            socket: socket,
            client: xmpp,
            trackId: function(id, callback) {
                if (typeof id !== 'object')
                    throw new Error('Stanza protection ID not added')
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

    beforeEach(function() {
        socket.removeAllListeners()
        xmpp.removeAllListeners()
        buddycloud.init(manager)
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
            socket.send('xmpp.buddycloud.presence')
        })

        it('Sends expected stanza', function(done) {
            xmpp.once('stanza', function(stanza) {
                stanza.is('presence').should.be.true
                stanza.attrs.to.should.equal(buddycloud.channelServer)
                stanza.getChildText('status').should.equal('buddycloud')
                stanza.getChildText('priority').should.equal('-1')
                stanza.getChildText('show').should.equal('chat')
                done()
            })
            socket.send('xmpp.buddycloud.presence')
        })

    })

})
