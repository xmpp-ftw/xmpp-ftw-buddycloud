'use strict';

var should  = require('should')
  , Buddycloud = require('../../index')
  , helper  = require('../helper')

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

    describe('Configuration', function() {

        describe('Get', function() {

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
                socket.send('xmpp.buddycloud.config.get', {})
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
                socket.send('xmpp.buddycloud.config.get', {}, true)
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
                socket.send('xmpp.buddycloud.config.get', {}, callback)
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
                    error.description.should.equal('Missing \'node\' key')
                    error.request.should.eql(request)
                    xmpp.removeAllListeners('stanza')
                    done()
                }
                socket.send(
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
                socket.send('xmpp.buddycloud.config.get', { node: 'some-node' }, function() {})
            })

            it('Can handle error response from server', function(done) {
                xmpp.once('stanza', function(stanza) {
                        stanza.is('iq').should.be.true
                        stanza.attrs.type.should.equal('get')
                        stanza.attrs.to.should.equal(buddycloud.channelServer)
                        should.exist(stanza.attrs.id)
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
                socket.send('xmpp.buddycloud.config.get', { node: 'some-node' }, callback)
            })

            it('Can handle no node information', function(done) {
                var request = {
                    of: 'wonderland.lit',
                    node: 'rabbithole'
                }
                xmpp.once('stanza', function() {
                        manager.makeCallback(helper.getStanza('disco-info'))
                    })
                var callback = function(error, data) {
                    should.not.exist(data)
                    error.type.should.equal('modify')
                    error.condition.should.equal('client-error')
                    error.description.should.equal('No node information found')
                    error.request.should.eql(request)
                    xmpp.removeAllListeners('stanza')
                    done()
                }
                socket.send('xmpp.buddycloud.config.get', request, callback)
            })

            it('Can handle successful response', function(done) {
                var request = {
                    of: 'wonderland.lit',
                    node: 'rabbithole'
                }
                xmpp.once('stanza', function() {
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
                socket.send('xmpp.buddycloud.config.get', request, callback)
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
                socket.send('xmpp.buddycloud.config.get', request, function() {})
            })

            it('Handles error response stanza', function(done) {
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
                    owner: true,
                    node: 'twelfth night'
                }
                socket.send('xmpp.buddycloud.config.get', request, callback)
            })

            it('Returns configuration data', function(done) {
                xmpp.once('stanza', function() {
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
                socket.send('xmpp.buddycloud.config.get', request, callback)
            })

        })

    })

    describe('Create', function() {

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
            socket.send('xmpp.buddycloud.create', {})
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
            socket.send('xmpp.buddycloud.create', {}, true)
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
            socket.send('xmpp.buddycloud.create', {}, callback)
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
                error.description.should.equal('Missing \'node\' key')
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.send(
                'xmpp.buddycloud.create',
                request,
                callback
            )
        })

        it('Errors with unparsable data form', function(done) {
            var request = {
                node: '/user/romeo@example.com/posts',
                options: {}
            }
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Badly formatted data form')
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.send(
                'xmpp.buddycloud.create',
                request,
                callback
            )
        })

        it('Sends the expected stanza', function(done) {
            var request = { node: '/user/romeo@example.com/posts' }
            xmpp.once('stanza', function(stanza) {
                stanza.is('iq').should.be.true
                stanza.attrs.type.should.equal('set')
                stanza.attrs.to.should.equal(request.to)
                should.exist(stanza.attrs.id)
                stanza.getChild('pubsub', buddycloud.NS_PUBSUB).should.exist
                var create = stanza.getChild('pubsub').getChild('create')
                create.attrs.node.should.equal(request.node)
                done()
            })
            socket.send('xmpp.buddycloud.create', request, function() {})
        })

        it('Sends expected stanza with data form (configuration)', function(done) {
            xmpp.once('stanza', function(stanza) {
                var dataForm = stanza.getChild('pubsub')
                    .getChild('configure')
                    .getChild('x', 'jabber:x:data')
                dataForm.should.exist
                dataForm.attrs.type.should.equal('submit')
                var fields = dataForm.children
                fields[0].name.should.equal('field')
                fields[0].attrs.var.should.equal('FORM_TYPE')
                fields[0].attrs.type.should.equal('hidden')
                fields[0].getChild('value').getText()
                    .should.equal(buddycloud.NS_CONFIG)
                fields[1].attrs.var.should.equal(request.options[0].var)
                fields[1].getChild('value').getText()
                    .should.equal(request.options[0].value)
                done()
            })
            var request = {
                node: '/user/romeo@example.com/posts',
                options: [{
                    var: 'pubsub#description',
                    value: 'Romeo\'s channel'
                }]
            }
            socket.send(
                'xmpp.buddycloud.create',
                request,
                function() {}
            )
        })

        it('Can handle error response from server', function(done) {
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
            socket.send('xmpp.buddycloud.create', { node: 'some-node' }, callback)
        })

    })

})