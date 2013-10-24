var should     = require('should')
  , Buddycloud = require('../../lib/buddycloud')
  , helper     = require('../helper')

var RSM_NS = require('xmpp-ftw/lib/utils/xep-0059').NS

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
        buddycloud.channelServer = 'channels.example.com'
    })

    describe('Publishing items', function() {

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
            socket.emit('xmpp.buddycloud.publish', {})
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
            socket.emit('xmpp.buddycloud.publish', {}, true)
        })

        it('Complains if discovery hasn\'t taken place', function(done) {
            delete buddycloud.channelServer
            socket.emit('xmpp.buddycloud.publish', {}, function(error, data) {
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
            var request = {
                node: '/user/juliet@example.net/posts',
                content: {
                    atom: {
                        content: 'Romeo, Romeo, wherefore art thou Romeo?'
                    }
                }
            }
            buddycloud.channelServer = 'channels.example.com'
            xmpp.once('stanza', function(stanza) {
                stanza.is('iq').should.be.true
                var pubsub = stanza.getChild('pubsub', buddycloud.NS_PUBSUB)
                pubsub.should.exist
                pubsub.getChild('publish').attrs.node.should.equal(request.node)
                var entry = pubsub.getChild('publish')
                    .getChild('item').getChild('entry')
                entry.should.exist
                entry.attrs.xmlns
                    .should.include('http://www.w3.org/2005/Atom')
                entry.getChildText('content')
                    .should.equal(request.content.atom.content)
                done()
            })
            socket.emit('xmpp.buddycloud.publish', request, function() {})
        })

    })

    describe('Recent items', function() {

        it('Errors if buddycloud server not discovered', function(done) {
            delete buddycloud.channelServer
            var callback = function(error, data) {
                should.not.exist(data)
                error.should.eql({
                    type: 'modify',
                    condition: 'client-error',
                    description: 'You must perform discovery first!',
                    request: {}
                })
                done()
            }
            socket.emit('xmpp.buddycloud.items.recent', {}, callback)
        })

        it('Sends expected stanza', function(done) {
            xmpp.once('stanza', function(stanza) {
                stanza.is('iq').should.be.true
                stanza.attrs.to.should.equal(buddycloud.channelServer)
                stanza.attrs.id.should.exist
                var pubsub = stanza.getChild('pubsub', buddycloud.NS_PUBSUB)
                pubsub.should.exist
                var recentItems = pubsub
                    .getChild('recent-items', buddycloud.NS_BUDDYCLOUD)
                recentItems.should.exist
                recentItems.attrs.max
                    .should.equal(buddycloud.maxRecentItemsPerChannel)
                recentItems.attrs.since.should.equal('2000-01-01T08:00:00.000Z')
                done()
            })
            socket.emit('xmpp.buddycloud.items.recent', {}, function() {})
        })

        it('Errors when date is unparsable', function(done) {
            var request = {
                since: 'not a date at all'
            }
            var callback = function(error, data) {
                should.not.exist(data)
                error.should.eql({
                    type: 'modify',
                    condition: 'client-error',
                    description: 'Recent date was unparsable',
                    request: request
                })
                done()
            }
            socket.emit('xmpp.buddycloud.items.recent', request, callback)
        })

        it('Sends expected stanza with parameters set', function(done) {
            var request = {
                since: new Date().toISOString(),
                max: '20'
            }
            xmpp.once('stanza', function(stanza) {
                var recentItems = stanza
                    .getChild('pubsub', buddycloud.NS_PUBSUB)
                    .getChild('recent-items', buddycloud.NS_BUDDYCLOUD)
                recentItems.attrs.since.should.equal(request.since)
                recentItems.attrs.max.should.equal(request.max)
                done()
            })
            socket.emit('xmpp.buddycloud.items.recent', request, function() {})
        })

        it('Sends expected stanza with RSM', function(done) {
            var request = {
                rsm: {
                    max: 30,
                    after: 'item-12345'
                }
            }
            xmpp.once('stanza', function(stanza) {
                var set = stanza.getChild('pubsub', buddycloud.NS_PUBSUB)
                    .getChild('set', RSM_NS)
                set.should.exist
                set.getChildText('max').should.equal('' + request.rsm.max)
                set.getChildText('after').should.equal(request.rsm.after)
                done()
            })
            socket.emit('xmpp.buddycloud.items.recent', request, function () {})
        })

        it('Handles error response', function(done) {
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('iq-error'))
            })
            var callback = function(error, data) {
                should.not.exist(data)
                error.should.eql({
                    type: 'cancel',
                    condition: 'error-condition'
                })
                done()
            }
            socket.emit('xmpp.buddycloud.items.recent', {}, callback)
        })

        it('Sends back expected data', function(done) {
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('recent-items'))
            })
            var callback = function(error, data) {
                should.not.exist(error)
                data.length.should.equal(3)
                data[0].node.should.equal('/user/romeo@example.com/posts')
                data[1].node.should.equal('/user/romeo@example.com/posts')
                data[2].node.should.equal('/user/juliet@example.net/posts')

                data[0].id.should.equal('item-1')
                data[1].id.should.equal('item-2')
                data[2].id.should.equal('item-3')
 
                data[0].entry.should.eql({ body: 'item-1-content' })
                data[1].entry.should.eql({ body: 'item-2-content' })
                data[2].entry.should.eql({ body: 'item-3-content' })
                done()
            }
            socket.emit('xmpp.buddycloud.items.recent', {}, callback)
        })

        it('Sends back RSM element', function(done) {
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('recent-items-rsm'))
            })
            var callback = function(error, data, rsm) {
                should.not.exist(error)
                rsm.should.eql({
                    count: 200,
                    first: 'item-1',
                    last: 'item-201'
                })
                done()
            }
            socket.emit('xmpp.buddycloud.items.recent', {}, callback)
        })

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
            socket.emit('xmpp.buddycloud.items.recent', {})
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
            socket.emit('xmpp.buddycloud.items.recent', {}, true)
        })

    })

    describe('Item replies', function() {

        it('Errors if buddycloud server not discovered', function(done) {
            delete buddycloud.channelServer
            var callback = function(error, data) {
                should.not.exist(data)
                error.should.eql({
                    type: 'modify',
                    condition: 'client-error',
                    description: 'You must perform discovery first!',
                    request: {}
                })
                done()
            }
            socket.emit('xmpp.buddycloud.items.replies', {}, callback)
        })
        
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
            socket.emit('xmpp.buddycloud.items.replies', {})
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
            socket.emit('xmpp.buddycloud.items.replies', {}, true)
        })

        it('Errors if no \'node\' provided', function(done) {
            var request = {}
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal("Missing 'node' key")
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.emit(
                'xmpp.buddycloud.items.replies',
                request,
                callback
            )
        })

        it('Errors if no \'id\' key provided', function(done) {
            var request = { node: '/users/romeo@example.com/posts' }
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal("Missing 'id' key")
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.emit(
                'xmpp.buddycloud.items.replies',
                request,
                callback
            )
        })

        it('Sends expected stanza', function(done) {
            var request = {
                node: '/user/romeo@example.com/posts',
                id: '1234'
            }
            xmpp.once('stanza', function(stanza) {
                stanza.is('iq').should.be.true
                stanza.attrs.to.should.equal(buddycloud.channelServer)
                stanza.attrs.id.should.exist
                var pubsub = stanza.getChild('pubsub', buddycloud.NS_PUBSUB)
                pubsub.should.exist
                var replies = pubsub
                    .getChild('replies', buddycloud.NS_BUDDYCLOUD)
                replies.should.exist
                replies.attrs.node
                    .should.equal(request.node)
                replies.attrs['item_id'].should.equal(request.id)
                done()
            })
            socket.emit('xmpp.buddycloud.items.replies', request, function() {})
        })
   
        it('Sends expected stanza with RSM applied', function(done) {
            var request = {
                node: '/user/romeo@example.com/posts',
                id: '1234',
                rsm: {
                    max: '20',
                    before: true
                }
            }
            xmpp.once('stanza', function(stanza) {
                var set = stanza.getChild('pubsub').getChild('set', RSM_NS)
                set.should.exist
                set.getChildText('max').should.equal(request.rsm.max)
                set.getChild('before').should.exist
                done()
            })
            socket.emit('xmpp.buddycloud.items.replies', request, function() {})
        })

        it('Handles an error reply', function(done) {
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
                node: '/user/romeo@example.com/post',
                id: '1234'
            }
            socket.emit(
                'xmpp.buddycloud.items.replies',
                request,
                callback
            )
        })

        it('Returns data in expected format', function(done) {
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('item-replies'))
            })
            var callback = function(error, success) {
                should.not.exist(error)
                success.length.should.equal(2)
                success[0].id.should.equal('item-1')
                success[0].entry.should.eql({ body: 'item-1-content' })
                success[0].node.should.equal(request.node)
                success[1].id.should.equal('item-2')
                success[1].entry.should.eql({ body: 'item-2-content' })
                success[1].node.should.equal(request.node)
                done()
            }
            var request = {
                node: '/user/romeo@example.com/post',
                id: '1234'
            }
            socket.emit(
                'xmpp.buddycloud.items.replies',
                request,
                callback
            )
        })

        it('Returns RSM element', function(done) {
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('item-replies-rsm'))
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
            var request = {
                node: '/user/romeo@example.com/post',
                id: '1234'
            }
            socket.emit(
                'xmpp.buddycloud.items.replies',
                request,
                callback
            )
        })

    })
    
    describe('Item retrieve', function() {
        
        // Note: Other tests all fallback on those from xmpp-ftw-pubsub

        it('Errors if buddycloud server not discovered', function(done) {
            delete buddycloud.channelServer
            var callback = function(error, data) {
                should.not.exist(data)
                error.should.eql({
                    type: 'modify',
                    condition: 'client-error',
                    description: 'You must perform discovery first!',
                    request: {}
                })
                done()
            }
            socket.emit('xmpp.buddycloud.retrieve', {}, callback)
        })
        
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
            socket.emit('xmpp.buddycloud.retrieve', {})
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
            socket.emit('xmpp.buddycloud.retrieve', {}, true)
        })
        
        it('Returns RSM element', function(done) {
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('item-replies-rsm'))
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
            var request = {
                node: '/user/romeo@example.com/post',
                id: '1234'
            }
            socket.emit(
                'xmpp.buddycloud.retrieve',
                request,
                callback
            )
        })
        
        it('Adds node key to each response item', function(done) {
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('item-replies'))
            })
            var callback = function(error, success) {
                should.not.exist(error)
                success.forEach(function(item) {
                    item.node.should.equal(request.node)
                })
                done()
            }
            var request = { node: '/user/romeo@example.com/post' }
            socket.emit(
                'xmpp.buddycloud.retrieve',
                request,
                callback
            )
        })
        
    })

    describe('Item thread', function() {

        it('Errors if buddycloud server not discovered', function(done) {
            delete buddycloud.channelServer
            var callback = function(error, data) {
                should.not.exist(data)
                error.should.eql({
                    type: 'modify',
                    condition: 'client-error',
                    description: 'You must perform discovery first!',
                    request: {}
                })
                done()
            }
            socket.emit('xmpp.buddycloud.items.thread', {}, callback)
        })

        it('Errors if no \'node\' provided', function(done) {
            var request = {}
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal("Missing 'node' key")
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.emit(
                'xmpp.buddycloud.items.thread',
                request,
                callback
            )
        })

        it('Errors if no \'id\' key provided', function(done) {
            var request = { node: '/users/romeo@example.com/posts' }
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal("Missing 'id' key")
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.emit(
                'xmpp.buddycloud.items.thread',
                request,
                callback
            )
        })

        it('Sends expected stanza', function(done) {
            var request = {
                node: '/user/romeo@example.com/posts',
                id: '1234'
            }
            xmpp.once('stanza', function(stanza) {
                stanza.is('iq').should.be.true
                stanza.attrs.to.should.equal(buddycloud.channelServer)
                stanza.attrs.id.should.exist
                var pubsub = stanza.getChild('pubsub', buddycloud.NS_PUBSUB)
                pubsub.should.exist
                var replies = pubsub
                    .getChild('thread', buddycloud.NS_BUDDYCLOUD)
                replies.should.exist
                replies.attrs.node
                    .should.equal(request.node)
                replies.attrs['item_id'].should.equal(request.id)
                done()
            })
            socket.emit('xmpp.buddycloud.items.thread', request, function() {})
        })
   
        it('Sends expected stanza with RSM applied', function(done) {
            var request = {
                node: '/user/romeo@example.com/posts',
                id: '1234',
                rsm: {
                    max: '20',
                    before: true
                }
            }
            xmpp.once('stanza', function(stanza) {
                var set = stanza.getChild('pubsub').getChild('set', RSM_NS)
                set.should.exist
                set.getChildText('max').should.equal(request.rsm.max)
                set.getChild('before').should.exist
                done()
            })
            socket.emit('xmpp.buddycloud.items.thread', request, function() {})
        })

        it('Handles an error reply', function(done) {
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
                node: '/user/romeo@example.com/post',
                id: '1234'
            }
            socket.emit(
                'xmpp.buddycloud.items.thread',
                request,
                callback
            )
        })

        it('Returns data in expected format', function(done) {
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('item-replies'))
            })
            var callback = function(error, success) {
                should.not.exist(error)
                success.length.should.equal(2)
                success[0].id.should.equal('item-1')
                success[0].entry.should.eql({ body: 'item-1-content' })
                success[0].node.should.equal(request.node)
                success[1].id.should.equal('item-2')
                success[1].entry.should.eql({ body: 'item-2-content' })
                success[1].node.should.equal(request.node)
                done()
            }
            var request = {
                node: '/user/romeo@example.com/post',
                id: '1234'
            }
            socket.emit(
                'xmpp.buddycloud.items.thread',
                request,
                callback
            )
        })

        it('Returns RSM element', function(done) {
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('item-replies-rsm'))
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
            var request = {
                node: '/user/romeo@example.com/post',
                id: '1234'
            }
            socket.emit(
                'xmpp.buddycloud.items.thread',
                request,
                callback
            )
        })
        
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
            socket.emit('xmpp.buddycloud.items.thread', {})
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
            socket.emit('xmpp.buddycloud.items.thread', {}, true)
        })

    })

})
