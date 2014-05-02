'use strict';

var Buddycloud = require('../../index')
  , helper  = require('../helper')
  , should  = require('should')

/* jshint -W030 */
describe('HTTP Request', function() {

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
            _getLogger: function() {
                return {
                    log: function() {},
                    info: function() {},
                    error: function() {},
                    warn: function() {}
                }
            },
            getJidType: function(type) {
                if ('domain' !== type)
                    throw new Error('Unexpected JID type requested')
                return 'example.com'
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
    
    describe('Incoming HTTP request', function() {
      
        var stanza = helper.getStanza('http-request-iq')
        
        it('Handles a request for a discovered media server', function() {
            buddycloud.mediaServers['shakespeare.lit'] = { component: 'files.shakespeare.lit' }
            buddycloud.handles(stanza).should.be.true
        })
        
        it('Doesn\'t handle a request from another sender', function() {
            buddycloud.handles(stanza).should.be.false
        })
        
        it('Emits the expected event', function(done) {
            socket.on('xmpp.buddycloud.http.verify', function() {
                done()
            })
            buddycloud.handle(stanza).should.be.true
        })
        
    })
    
    describe('Responding to a request', function() {
        
        it('Allows a user to verify their request', function(done) {
            var request = { type: 'iq', id: '1', to: 'you' }
            xmpp.on('stanza', function(stanza) {
                stanza.is('iq').should.be.true
                stanza.attrs.type.should.equal('result')
                done()
            })
            var callback = function(error, success) {
                should.not.exist(error)
                success.should.be.true
            }
            socket.send('xmpp.buddycloud.http.confirm', request, callback)
        })
        
        it('Allows a user to deny their request', function(done) {
            var request = { type: 'iq', id: '1', to: 'you' }
            xmpp.on('stanza', function(stanza) {
                stanza.is('iq').should.be.true
                stanza.attrs.type.should.equal('error')
                done()
            })
            var callback = function(error, success) {
                should.not.exist(error)
                success.should.be.true
            }
            socket.send('xmpp.buddycloud.http.deny', request, callback)
        })
        
    })

})
