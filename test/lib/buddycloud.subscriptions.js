'use strict';

var Buddycloud = require('../../index')
  , helper  = require('../helper')
  , should  = require('should')

/* jshint -W030 */
describe('Subscriptions', function() {

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

    describe('Get subscriptions', function() {

        it('Errors when no callback provided', function(done) {
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            socket.once('xmpp.error.client', function(error) {
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Missing callback')
                error.request.should.eql({})
                xmpp.removeAllListeners('stanza')
                done()
            })
            socket.send('xmpp.buddycloud.subscriptions', {})
        })

        it('Errors when non-function callback provided', function(done) {
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            socket.once('xmpp.error.client', function(error) {
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Missing callback')
                error.request.should.eql({})
                xmpp.removeAllListeners('stanza')
                done()
            })
            socket.send('xmpp.buddycloud.subscriptions', {}, true)
        })

        it('Sends expected stanza for node', function(done) {
            var request = {
                node: '/user/romeo@example.com/posts'
            }
            xmpp.once('stanza', function(stanza) {
                stanza.is('iq').should.be.true
                stanza.attrs.to.should.equal(request.to)
                stanza.attrs.type.should.equal('get')
                stanza.attrs.id.should.exist
                stanza.getChild('pubsub', buddycloud.NS_PUBSUB).should.exist
                var pubsubElement = stanza.getChild('pubsub')
                pubsubElement.getChild('subscriptions').should.exist
                pubsubElement.getChild('subscriptions').attrs.node
                    .should.equal(request.node)
                done()
            })
            socket.send('xmpp.buddycloud.subscriptions', request, function() {})
        })

        it('Sends expected stanza for user subscriptions', function(done) {
            var request = {}
            xmpp.once('stanza', function(stanza) {
                stanza.is('iq').should.be.true
                stanza.attrs.to.should.equal(request.to)
                stanza.attrs.type.should.equal('get')
                stanza.attrs.id.should.exist
                stanza.getChild('pubsub', buddycloud.NS_PUBSUB).should.exist
                var pubsubElement = stanza.getChild('pubsub')
                pubsubElement.getChild('subscriptions').should.exist
                should.not.exist(
                    pubsubElement.getChild('subscriptions').attrs.node
                )
                done()
            })
            socket.send('xmpp.buddycloud.subscriptions', request, function() {})
        })

        it('Handles error stanza response', function(done) {
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('iq-error'))
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.should.eql({
                    type: 'cancel',
                    condition: 'error-condition'
                })
                done()
            }
            var request = {
                node: '/user/romeo@example.com/posts'
            }
            socket.send(
                'xmpp.buddycloud.subscriptions',
                request,
                callback
            )

        })

        it('Sends a list of subscriptions', function(done) {
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('subscriptions'))
            })
            var callback = function(error, data) {
                should.not.exist(error)
                data.length.should.equal(3)
                data[0].node.should.equal('/user/romeo@example.com/posts')
                data[0].jid.should.eql({
                    domain: 'example.com',
                    user: 'romeo'
                })
                data[0].subscription.should.equal('subscribed')
                should.not.exist(data[0].id)
                data[1].node.should.equal('/user/juliet@example.net/posts')
                data[1].jid.should.eql({
                    domain: 'example.com',
                    user: 'romeo'
                })
                data[1].subscription.should.equal('pending')
                data[2].node.should.equal('/user/juliet@example.net/posts')
                data[2].jid.should.eql({
                    domain: 'example.com',
                    user: 'macbeth'
                })
                data[2].invitedBy.should.eql({
                    domain: 'coven.shakespeare.lit',
                    user: 'witches'
                })
                data[2].subscription.should.equal('invited')
                done()
            }
            var request = {
                node: '/user/romeo@example.com/posts'
            }
            socket.send(
                'xmpp.buddycloud.subscriptions',
                request,
                callback
            )
        })

        it('Adds RSM to outgoing stanza', function(done) {
            var request = {
                node: '/user/romeo@example.com/posts',
                rsm: {
                    max: '20',
                    before: 'item-123'
                }
            }
            xmpp.once('stanza', function(stanza) {
                var rsm = stanza.getChild('pubsub').getChild('set', buddycloud.RSM_NS)
                rsm.getChildText('max').should.equal(request.rsm.max)
                rsm.getChildText('before').should.equal(request.rsm.before)
                done()
            })
            socket.send('xmpp.buddycloud.subscriptions', request, function() {})
        })

        it('Adds RSM to results', function(done) {
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('subscriptions-with-rsm'))
            })
            var callback = function(error, data, rsm) {
                should.not.exist(error)
                should.exist(data)
                rsm.should.eql({
                    count: 20,
                    first: 'item-1',
                    last: 'item-10'
                })
                done()
            }
            var request = {
                node: '/user/romeo@example.com/posts'
            }
            socket.send(
                'xmpp.buddycloud.subscriptions',
                request,
                callback
            )
        })

    })

})
