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
      buddycloud.channelServer = 'channels.shakespeare.lit'
    })
    
    describe('Register', function() {

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
            socket.emit('xmpp.buddycloud.register', {}, callback)
        })
        
        it('Sends expected stanza', function(done) {
          xmpp.once('stanza', function(stanza) {
            stanza.is('iq').should.be.true
            stanza.attrs.to.should.equal('channels.shakespeare.lit')
            stanza.attrs.id.should.exist
            stanza.getChild('query', 'jabber:iq:register').should.exist
            done()
          })
          socket.emit(
              'xmpp.buddycloud.register',
              {},
              function() {}
          )
        })
    })
    
})
