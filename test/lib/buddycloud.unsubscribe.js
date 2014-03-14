'use strict';

var Buddycloud = require('../../index')
  , helper  = require('../helper')

/* jshint -W030 */
describe('Unsubscribe', function() {

    var buddycloud, socket, xmpp, manager

    before(function() {
        socket = new helper.SocketEventer()
        xmpp = new helper.XmppEventer()
        manager = {
            socket: socket,
            client: xmpp,
            trackId: function(id, callback) {
                this.callback = callback
            },
            makeCallback: function(error, data) {
                this.callback(error, data)
            },
            jid: 'juliet@capulet.lit',
            _getLogger: function() {
                return {
                    log: function() {},
                    info: function() {},
                    error: function() {},
                    warn: function() {}
                }
            },
            getJidType: function(type) {
                if ('bare' === type) {
                    return 'juliet@capulet.lit'
                }
                throw new Error('Unknown JID type')
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

    it('Overwrites JID with bare JID', function(done) {
        var request = {
            jid: 'juliet@capulet.lit/balcony',
            to: 'channels.capulet.lit',
            node: '/user/romeo@montague.lit/posts'
        }
        xmpp.once('stanza', function(stanza) {
            stanza.is('iq').should.be.true
            stanza.attrs.to.should.equal(request.to)
            stanza.attrs.type.should.equal('set')
            var pubsub = stanza.getChild('pubsub', buddycloud.NS_PUBSUB)
            pubsub.should.exist
            var unsubscribe = pubsub.getChild('unsubscribe')
            unsubscribe.should.exist
            unsubscribe.attrs.node.should.equal(request.node)
            unsubscribe.attrs.jid.should.equal(manager.jid)
            done()
        })
        socket.send('xmpp.buddycloud.unsubscribe', request, function() {})
    })

})
