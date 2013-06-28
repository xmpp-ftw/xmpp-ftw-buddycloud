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

    describe('Channel server discover', function() {

        it('Sends out expected disco#items stanzas', function(done) {
            xmpp.once('stanza', function(stanza) {
                stanza.is('iq').should.be.true
                stanza.attrs.to.should.equal('example.com')
                stanza.attrs.type.should.equal('get')
                stanza.attrs.id.should.exist
                stanza.getChild('query', buddycloud.disco.NS_ITEMS)
                    .should.exist
                done()
            })
            socket.emit('xmpp.buddycloud.discover')
        })


    })
})
