var should     = require('should')
  , Buddycloud = require('../../lib/buddycloud')
  , ltx        = require('ltx')
  , helper     = require('../helper')

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

    describe('Publishing items', function() {

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
            socket.emit('xmpp.buddycloud.publish', request)
        })

    })

})
