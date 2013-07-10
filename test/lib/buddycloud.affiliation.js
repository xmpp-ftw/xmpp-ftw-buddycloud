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
            }
        }
        buddycloud = new Buddycloud()
        buddycloud.init(manager)
    })
    
    beforeEach(function() {
        buddycloud.channelServer = 'channels.example.com'
    })

    describe('Get affiliations', function() {

        it('Errors when no callback provided', function(done) {
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            socket.once('xmpp.error.client', function(error) {
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal("Missing callback")
                error.request.should.eql({})
                xmpp.removeAllListeners('stanza')
                done()
            })
            socket.emit('xmpp.buddycloud.affiliations', {})
        })

        it('Errors when non-function callback provided', function(done) {
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            socket.once('xmpp.error.client', function(error) {
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal("Missing callback")
                error.request.should.eql({})
                xmpp.removeAllListeners('stanza')
                done()
            })
            socket.emit('xmpp.buddycloud.affiliations', {}, true)
        })

        it('Complains if discovery hasn\'t taken place', function(done) {
            delete buddycloud.channelServer
            socket.emit('xmpp.buddycloud.affiliations', {}, function(error, data) {
                should.not.exist(data)
                error.should.eql({
                    type: 'modify',
                    condition: 'client-error',
                    description: 'You must perform discovery first!',
                    request: {}
                })
                done()                
            })
        })

        it('Sends expected stanza', function(done) {
            var request = {}
            xmpp.once('stanza', function(stanza) {
                stanza.is('iq').should.be.true
                var pubsub = stanza.getChild('pubsub', buddycloud.NS_PUBSUB)
                pubsub.should.exist
                pubsub.getChild('affiliations').should.exist
                done()
            })
            socket.emit('xmpp.buddycloud.affiliations', request, function() {})
        })
        
        it('Handles an error reply', function(done) {
            xmpp.once('stanza', function(stanza) {
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
                node: '/user/romeo@example.com/post',
            }
            socket.emit(
                'xmpp.buddycloud.affiliations',
                request,
                callback
            )
        })

        it('Returns data in expected format', function(done) {
            xmpp.once('stanza', function(stanza) {
                manager.makeCallback(helper.getStanza('affiliations'))
            })
            var callback = function(error, success) {
                should.not.exist(error)
                success.length.should.equal(2)
                success[0].node.should.equal('/user/romeo@example.com/posts')
                success[0].jid.should.eql({
                    domain: 'example.com',
                    user: 'romeo'
                })
                success[0].affiliation.should.equal('owner')
                success[1].node.should.equal('/user/juliet@example.net/posts')
                success[1].jid.should.eql({
                    domain: 'example.com',
                    user: 'romeo'
                })
                success[1].affiliation.should.equal('member')
                done()
            }
            var request = {}
            socket.emit(
                'xmpp.buddycloud.affiliations',
                request,
                callback
            )
        })

        it('Returns RSM element', function(done) {
            xmpp.once('stanza', function(stanza) {
                manager.makeCallback(helper.getStanza('affiliations-with-rsm'))
            })
            var callback = function(error, success, rsm) {
                should.not.exist(error)
                rsm.should.eql({
                    count: 20,
                    first: 'item-1',
                    last: 'item-10'
                })
                done()
            }
            var request = {}
            socket.emit(
                'xmpp.buddycloud.affiliations',
                request,
                callback
            )
        })

    })
})
