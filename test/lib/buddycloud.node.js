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
    
    describe('Configuration', function() {
      
        describe('Get', function() {

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
                socket.emit('xmpp.buddycloud.config.get', {})
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
                socket.emit('xmpp.buddycloud.config.get', {}, true)
            })
            
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
                socket.emit('xmpp.buddycloud.config.get', {}, callback)
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
                    'xmpp.buddycloud.config.get',
                    request,
                    callback
                )
            })
            
            it('Sends the expected stanza', function(done) {
                xmpp.once('stanza', function(stanza) {
                    stanza.is('iq').should.be.true
                    stanza.attrs.to.should.equal(buddycloud.channelServer)
                    stanza.attrs.type.should.equal('get')
                    stanza.attrs.id.should.exist
                    stanza.getChild('query', buddycloud.disco.NS_INFO)
                        .should.exist
                    done() 
                })
                socket.emit('xmpp.buddycloud.config.get', { node: 'some-node' }, function() {})
            })
            
            it('Can handle error response from server', function(done) {
                xmpp.once('stanza', function(stanza) {
                     stanza.is('iq').should.be.true
                     stanza.attrs.type.should.equal('get')
                     stanza.attrs.to.should.equal(buddycloud.channelServer)
                     should.exist(stanza.attrs.id)
                     var query = stanza.getChild('query', buddycloud.disco.NS_INFO)
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
                socket.emit('xmpp.buddycloud.config.get', { node: 'some-node' }, callback)
            })
            
            it('Can handle no node information', function(done) {
                var request = {
                    of: 'wonderland.lit',
                    node: 'rabbithole'
                }
                xmpp.once('stanza', function(stanza) {
                     manager.makeCallback(helper.getStanza('disco-info'))
                })
                var callback = function(error, data) {
                    should.not.exist(data)
                    error.type.should.equal('modify')
                    error.condition.should.equal('client-error')
                    error.description.should.equal("No node information found")
                    error.request.should.eql(request)
                    xmpp.removeAllListeners('stanza')
                    done()
                }
                socket.emit('xmpp.buddycloud.config.get', request, callback)
            })

            it('Can handle successful response', function(done) {
                var request = {
                    of: 'wonderland.lit',
                    node: 'rabbithole'
                }
                xmpp.once('stanza', function(stanza) {
                     manager.makeCallback(helper.getStanza('disco-info-with-data-form'))
                })
                var callback = function(error, data) {
                    should.not.exist(error)
                    data.length.should.equal(1)
                    data[0].var.should.equal('var1')
                    data[0].value.should.equal('value1')
                    data[0].label.should.equal('label1')
                    done()
                }
                socket.emit('xmpp.buddycloud.config.get', request, callback)
            })
            
            it('Sends the expected stanza for owner request', function(done) {
                var request = { node: 'some-node', owner: true }
                xmpp.once('stanza', function(stanza) {
                    stanza.is('iq').should.be.true
                    stanza.attrs.to.should.equal(request.to)
                    stanza.attrs.id.should.exist
                    stanza.attrs.type.should.equal('get')
                    var configure = stanza.getChild('pubsub', buddycloud.NS_OWNER)
                        .getChild('configure')
                    configure.should.exist
                    configure.attrs.node.should.equal(request.node)
                    done()
                })
                socket.emit('xmpp.buddycloud.config.get', request, function() {})
            })
            
            it('Handles error response stanza', function(done) {
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
                    owner: true,
                    node: 'twelfth night'
                }
                socket.emit('xmpp.buddycloud.config.get', request, callback)
            })
    
            it('Returns configuration data', function(done) {
                xmpp.once('stanza', function(stanza) {
                    manager.makeCallback(helper.getStanza('configuration'))
                })
                var callback = function(error, data) {
                    should.not.exist(error)
                    data.fields.length.should.equal(2)
                    data.fields[0].var.should.equal('pubsub#title')
                    data.fields[0].type.should.equal('text-single')
                    data.fields[0].label.should.equal('News about a funny play')
                    data.fields[1].var.should.equal('pubsub#deliver_notifications')
                    data.fields[1].type.should.equal('boolean')
                    data.fields[1].label.should.equal('Send notifications?')
                    data.fields[1].value.should.be.true
                    done()
                }
                var request = {
                    owner: true,
                    node: 'twelfth night'
                }
                socket.emit('xmpp.buddycloud.config.get', request, callback)
            })
            
        })
                 
    })

})
