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
            jid: 'romeo@example.com',
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
    })

    beforeEach(function() {
        socket.removeAllListeners()
        xmpp.removeAllListeners()
        buddycloud = new Buddycloud()
        buddycloud.init(manager)
        buddycloud.channelServer = 'channels.example.com'
    })

    describe('Channel server discover', function() {

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
            socket.send('xmpp.buddycloud.discover', {})
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
            socket.send('xmpp.buddycloud.discover', {}, true)
        })

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
            socket.send('xmpp.buddycloud.discover', null, function() {})
        })

        it('Tracks and can handle an error response', function(done) {
            xmpp.once('stanza', function(stanza) {
                var errorResponse = helper.getStanza('iq-error')
                errorResponse.attrs.id = stanza.attrs.id
                manager.makeCallback(errorResponse)
            })
            socket.send('xmpp.buddycloud.discover', {}, function(error, items) {
                should.not.exist(items)
                error.type.should.equal('cancel')
                error.condition.should.equal('error-condition')
                done()
            })
        })

        it('Handles disco#items and sends expected stanzas', function(done) {
            xmpp.once('stanza', function() {
                var discoInfoRequests = 0
                xmpp.on('stanza', function(stanza) {
                    stanza.is('iq').should.be.true
                    stanza.attrs.to.should.include('example.com')
                    stanza.attrs.type.should.equal('get')
                    stanza.attrs.id.should.exist
                    stanza.getChild('query', buddycloud.disco.NS_INFO)
                        .should.exist
                    discoInfoRequests++
                    if (discoInfoRequests >= 3) done()
                })
                manager.makeCallback(helper.getStanza('disco-items'))
            })
            socket.send('xmpp.buddycloud.discover', null, function() {})
        })

        it('Handles error responses; returns failure', function(done) {
            xmpp.once('stanza', function() {
                xmpp.on('stanza', function(stanza) {
                    var errorReply = helper.getStanza('iq-error')
                    errorReply.attrs.id = stanza.attrs.id
                    manager.makeCallback(errorReply)
                })
                manager.makeCallback(helper.getStanza('disco-items'))
            })
            socket.send('xmpp.buddycloud.discover', {}, function(error, item) {
                should.not.exist(item)
                error.should.equal('No buddycloud server found')
                done()
            })
        })

        it('Handles disco#info responses; returns failure', function(done) {
            xmpp.once('stanza', function() {
                xmpp.on('stanza', function(stanza) {
                    var infoReply = helper.getStanza('disco-info')
                    infoReply.attrs.id = stanza.attrs.id
                    manager.makeCallback(infoReply)
                })
                manager.makeCallback(helper.getStanza('disco-items'))
            })
            socket.send('xmpp.buddycloud.discover', {}, function(error, item) {
                should.not.exist(item)
                error.should.equal('No buddycloud server found')
                done()
            })
        })

        it('Handles disco#info responses returns server information', function(done) {
            xmpp.once('stanza', function() {
                var discoInfoRequests = 0
                xmpp.on('stanza', function() {
                    ++discoInfoRequests
                    if (2 === discoInfoRequests)
                        return manager.makeCallback(
                            helper.getStanza('disco-info-buddycloud')
                        )
                    manager.makeCallback(
                        helper.getStanza('disco-info')
                    )
                })
                manager.makeCallback(helper.getStanza('disco-items'))
            })
            socket.send('xmpp.buddycloud.discover', {}, function(error, item) {
                should.not.exist(error)
                item.should.equal('channels.example.com')
                buddycloud.channelServer.should.equal('channels.example.com')
                done()
            })
        })

        it('Handles unresponsive components', function(done) {
            buddycloud.setDiscoveryTimeout(100)
            xmpp.once('stanza', function() {
                xmpp.on('stanza', function() {
                    // ...do nothing...
                })
                manager.makeCallback(helper.getStanza('disco-items'))
            })
            socket.send('xmpp.buddycloud.discover', {}, function(error, item) {
                should.not.exist(item)
                error.should.equal('No buddycloud server found')
                done()
            })
        })

        it('Doesn\'t wait for a single slow component', function(done) {
            this.timeout(205)
            buddycloud.setDiscoveryTimeout(200)
            var counter = 0
            xmpp.on('stanza', function(stanza) {
                if (-1 !== stanza.toString().indexOf('disco#items')) {
                    return manager.makeCallback(helper.getStanza('disco-items'))
                }
                if (0 === counter) {
                    setTimeout(function() {
                        manager.makeCallback(helper.getStanza('disco-info'))
                    }, 350)
                } else if (1 === counter) {
                    manager.makeCallback(helper.getStanza('disco-info-buddycloud'))
                } else if (counter > 1) {
                    manager.makeCallback(helper.getStanza('disco-info'))
                }
                ++counter
            })
            socket.send('xmpp.buddycloud.discover', {}, function(error, item) {
                should.not.exist(error)
                item.should.equal('channels.example.com')
                done()
            })
        })

        it('Slow component reply doesn\'t callback() twice', function(done) {
            buddycloud.setDiscoveryTimeout(100)
            xmpp.on('stanza', function(stanza) {
                if (-1 !== stanza.toString().indexOf('disco#items')) {
                    manager.makeCallback(helper.getStanza('disco-items'))
                    setTimeout(function() {
                        done()
                    }, 300)
                }
                setTimeout(function() {
                    manager.makeCallback(helper.getStanza('disco-info'))
                }, 200)
            })
            socket.send('xmpp.buddycloud.discover', {}, function(error, item) {
                should.not.exist(item)
                error.should.equal('No buddycloud server found')
            })
        })
        
        describe('Cache', function() {
        
            it('Caches discovery if available', function(done) {
                var cache = {}
                buddycloud.setCache(cache)
                xmpp.once('stanza', function() {
                    var discoInfoRequests = 0
                    xmpp.on('stanza', function() {
                        ++discoInfoRequests
                        if (2 === discoInfoRequests)
                            return manager.makeCallback(
                                helper.getStanza('disco-info-buddycloud')
                            )
                        manager.makeCallback(
                            helper.getStanza('disco-info')
                        )
                    })
                    manager.makeCallback(helper.getStanza('disco-items'))
                })
                socket.send('xmpp.buddycloud.discover', {}, function() {
                    cache.buddycloud.server.channel['example.com']
                        .should.equal('channels.example.com')
                    buddycloud.channelServer = 'channels.example.com'
                    done()
                })
            })
            
            it('Does not perform discovery again if cached', function(done) {
                var cache = {}
                buddycloud.setCache(cache)
                xmpp.once('stanza', function() {
                    var discoInfoRequests = 0
                    xmpp.on('stanza', function() {
                        ++discoInfoRequests
                        if (2 === discoInfoRequests) {
                            return manager.makeCallback(
                                helper.getStanza('disco-info-buddycloud')
                            )
                        }
                        manager.makeCallback(
                            helper.getStanza('disco-info')
                        )
                    })
                    manager.makeCallback(helper.getStanza('disco-items'))
                })
                socket.send('xmpp.buddycloud.discover', {}, function(error, item) {
                    item.should.equal('channels.example.com')
                    cache.buddycloud.server.channel['example.com']
                        .should.equal('channels.example.com')
                    socket.on('stanza', function() {
                        done('Should not have performed DISCO again')
                    })
                    socket.send('xmpp.buddycloud.discover', {}, function(error, item) {
                        item.should.equal('channels.example.com')
                        done()
                    })
                })
            })
            
            it('Performs discovery again if caching not available', function(done) {
                buddycloud.setCache(null)
                xmpp.once('stanza', function() {
                    var requests = 0
                    xmpp.on('stanza', function() {
                        ++requests
                        if (2 === requests) {
                            return manager.makeCallback(
                                helper.getStanza('disco-info-buddycloud')
                            )
                        }
                        /* We complete the test here */
                        if (3 === requests) {
                            done()
                            return
                        }
                        manager.makeCallback(
                            helper.getStanza('disco-info')
                        )
                    })
                    manager.makeCallback(helper.getStanza('disco-items'))
                })
                socket.send('xmpp.buddycloud.discover', {}, function(error, item) {
                    item.should.equal('channels.example.com')
                    socket.send('xmpp.buddycloud.discover', {}, function() {
                        done('Should not have had a cache to return from')
                    })
                })
            })
            
            it('Does not cache if domain is supplied', function(done) {
                var cache = {}
                buddycloud.setCache(cache)
                socket.send('xmpp.buddycloud.discover', { server: 'channels.example.com' }, function() {
                    should.not.exist(cache.buddycloud)
                    done()
                })
            })
            
        })

    })

    describe('Disco proxy', function() {

        it('Responses to disco#info events', function(done) {
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function() {
                done()
            }
            socket.send('xmpp.buddycloud.discover.info', {}, callback)
        })

        it('Responds to disco#items events', function(done) {
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function() {
                done()
            }
            socket.send('xmpp.buddycloud.discover.items', {}, callback)
        })

    })

    it('Allows manual setting of channel server', function(done) {

        socket.send(
            'xmpp.buddycloud.discover',
            { server: 'channels.example.com' },
            function(error, item) {

            should.not.exist(error)
            item.should.equal('channels.example.com')
            buddycloud.channelServer.should.equal('channels.example.com')
            done()
        })
    })
    
    describe('Discover media server', function() {

        var request = { of: 'example.com' }
        
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
            socket.send('xmpp.buddycloud.discover.media-server', {})
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
            socket.send('xmpp.buddycloud.discover.media-server', {}, true)
        })
        
        it('Errors if no \'of\' key provided', function(done) {
            socket.send('xmpp.buddycloud.discover.media-server', {}, function(error) {
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Missing \'of\' key')
                error.request.should.eql({})
                done()
            })
        })

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
            socket.send('xmpp.buddycloud.discover.media-server', request, function() {})
        })

        it('Tracks and can handle an error response', function(done) {
            xmpp.once('stanza', function(stanza) {
                var errorResponse = helper.getStanza('iq-error')
                errorResponse.attrs.id = stanza.attrs.id
                manager.makeCallback(errorResponse)
            })
            socket.send(
                'xmpp.buddycloud.discover.media-server',
                request,
                function(error, items) {
                    should.not.exist(items)
                    error.type.should.equal('cancel')
                    error.condition.should.equal('error-condition')
                    done()
                }
            )
        })

        it('Handles disco#items and sends expected stanzas', function(done) {
            xmpp.once('stanza', function() {
                var discoInfoRequests = 0
                xmpp.on('stanza', function(stanza) {
                    stanza.is('iq').should.be.true
                    stanza.attrs.to.should.include('example.com')
                    stanza.attrs.type.should.equal('get')
                    stanza.attrs.id.should.exist
                    stanza.getChild('query', buddycloud.disco.NS_INFO)
                        .should.exist
                    discoInfoRequests++
                    if (discoInfoRequests >= 3) done()
                })
                manager.makeCallback(helper.getStanza('disco-items'))
            })
            socket.send('xmpp.buddycloud.discover.media-server', request, function() {})
        })

        it('Handles error responses; returns failure', function(done) {
            xmpp.once('stanza', function() {
                xmpp.on('stanza', function(stanza) {
                    var errorReply = helper.getStanza('iq-error')
                    errorReply.attrs.id = stanza.attrs.id
                    manager.makeCallback(errorReply)
                })
                manager.makeCallback(helper.getStanza('disco-items'))
            })
            socket.send(
                'xmpp.buddycloud.discover.media-server',
                request,
                function(error, item) {
                    should.not.exist(item)
                    error.should.eql({ type: 'cancel', condition: 'item-not-found' })
                    done()
                }
            )
        })

        it('Handles disco#info responses; returns failure', function(done) {
            xmpp.once('stanza', function() {
                xmpp.on('stanza', function(stanza) {
                    var infoReply = helper.getStanza('disco-info')
                    infoReply.attrs.id = stanza.attrs.id
                    manager.makeCallback(infoReply)
                })
                manager.makeCallback(helper.getStanza('disco-items'))
            })
            socket.send(
                'xmpp.buddycloud.discover.media-server',
                request,
                function(error, item) {
                    should.not.exist(item)
                    error.should.eql({ type: 'cancel', condition: 'item-not-found' })
                    done()
                }
            )
        })

        it('Handles disco#info responses returns server information', function(done) {
            xmpp.once('stanza', function() {
                var discoInfoRequests = 0
                xmpp.on('stanza', function() {
                    ++discoInfoRequests
                    if (3 === discoInfoRequests)
                        return manager.makeCallback(
                            helper.getStanza('disco-info-media-server-no-endpoint')
                        )
                    manager.makeCallback(
                        helper.getStanza('disco-info')
                    )
                })
                manager.makeCallback(helper.getStanza('disco-items'))
            })
            socket.send(
                'xmpp.buddycloud.discover.media-server',
                request,
                function(error, item) {
                    should.not.exist(error)
                    item.component.should.equal('media.example.com')
                    should.not.exist(item.endpoint)
                    done()
                }
            )
        })

        it('Handles unresponsive components', function(done) {
            buddycloud.setMediaServerDiscoveryTimeout(1)
            xmpp.once('stanza', function() {
                xmpp.on('stanza', function() {
                    // ...do nothing...
                })
                manager.makeCallback(helper.getStanza('disco-items'))
            })
            socket.send(
                'xmpp.buddycloud.discover.media-server',
                request,
                function(error, item) {
                    should.not.exist(item)
                    error.should.eql({ type: 'cancel', condition: 'item-not-found' })
                    done()
                }
            )
        })

        it('Slow component reply doesn\'t callback() twice', function(done) {
            buddycloud.setMediaServerDiscoveryTimeout(0)
            xmpp.on('stanza', function(stanza) {
                if (-1 !== stanza.toString().indexOf('disco#items')) {
                    manager.makeCallback(helper.getStanza('disco-items'))
                    setTimeout(function() {
                        done()
                    }, 3)
                }
                setTimeout(function() {
                    manager.makeCallback(helper.getStanza('disco-info'))
                }, 2)
            })
            socket.send(
                'xmpp.buddycloud.discover.media-server',
                request,
                function(error, item) {
                    should.not.exist(item)
                    error.should.eql({ type: 'cancel', condition: 'item-not-found' })
                }
            )
        })
        
        it('Gets media server with endpoint advertised', function(done) {
            xmpp.once('stanza', function() {
                var discoInfoRequests = 0
                xmpp.on('stanza', function() {
                    ++discoInfoRequests
                    if (3 === discoInfoRequests)
                        return manager.makeCallback(
                            helper.getStanza('disco-info-media-server')
                        )
                    manager.makeCallback(
                        helper.getStanza('disco-info')
                    )
                })
                manager.makeCallback(helper.getStanza('disco-items'))
            })
            socket.send(
                'xmpp.buddycloud.discover.media-server',
                request,
                function(error, item) {
                    should.not.exist(error)
                    item.component.should.equal('media.example.com')
                    item.endpoint.should.equal('https://api.buddycloud.org')
                    done()
                }
            )
        })
 
        describe('Cache', function() {
        
            it('Caches discovery if available', function(done) {
                var cache = {}
                buddycloud.setCache(cache)
                xmpp.once('stanza', function() {
                    var discoInfoRequests = 0
                    xmpp.on('stanza', function() {
                        ++discoInfoRequests
                        if (3 === discoInfoRequests) {
                            return manager.makeCallback(
                                helper.getStanza('disco-info-media-server')
                            )
                        }
                        manager.makeCallback(
                            helper.getStanza('disco-info')
                        )
                    })
                    manager.makeCallback(helper.getStanza('disco-items'))
                })
                socket.send('xmpp.buddycloud.discover.media-server', { of: 'example.com' }, function() {
                    var expected = {
                        component: 'media.example.com',
                        endpoint: 'https://api.buddycloud.org'
                    }
                    buddycloud.mediaServers['example.com'].should.eql(expected)
                    cache.buddycloud.server.media['example.com']
                        .should.eql(expected)
                    done()
                })
            })
            
            it('Does not perform discovery again if cached', function(done) {
                var cache = {}
                buddycloud.setCache(cache)
                xmpp.once('stanza', function() {
                    var discoInfoRequests = 0
                    xmpp.on('stanza', function() {
                        ++discoInfoRequests
                        if (2 === discoInfoRequests) {
                            return manager.makeCallback(
                                helper.getStanza('disco-info-media-server')
                            )
                        }
                        manager.makeCallback(
                            helper.getStanza('disco-info')
                        )
                    })
                    manager.makeCallback(helper.getStanza('disco-items'))
                })
                var request = { of: 'example.com' }
                var event = 'xmpp.buddycloud.discover.media-server'
                socket.send(event, request, function(error, item) {
                    item.should.eql({
                        component: 'channels.example.com',
                        endpoint: 'https://api.buddycloud.org'
                    })
                    cache.buddycloud.server.media['example.com']
                        .should.eql({
                            component: 'channels.example.com',
                            endpoint: 'https://api.buddycloud.org'
                        })
                    socket.on('stanza', function() {
                        done('Should not have performed DISCO again')
                    })
                    socket.send(event, request, function(error, item) {
                        item.should.eql({
                            component: 'channels.example.com',
                            endpoint: 'https://api.buddycloud.org'
                        })
                        done()
                    })
                })
            })
            
            it('Performs discovery again if caching not available', function(done) {
                buddycloud.setCache(null)
                xmpp.once('stanza', function() {
                    var requests = 0
                    xmpp.on('stanza', function() {
                        ++requests
                        if (2 === requests) {
                            return manager.makeCallback(
                                helper.getStanza('disco-info-media-server')
                            )
                        }
                        /* We complete the test here */
                        if (3 === requests) {
                            done()
                            return
                        }
                        manager.makeCallback(
                            helper.getStanza('disco-info')
                        )
                    })
                    manager.makeCallback(helper.getStanza('disco-items'))
                })
                socket.send('xmpp.buddycloud.discover.media-server', { of: 'example.com' }, function(error, item) {
                    item.should.eql({
                        component: 'channels.example.com',
                        endpoint: 'https://api.buddycloud.org'
                    })
                    buddycloud.mediaServers['example.com'] = null
                    socket.send('xmpp.buddycloud.discover', {}, function() {
                        done('Should not have had a cache to return from')
                    })
                })
            })
            
        })

        
    })

})