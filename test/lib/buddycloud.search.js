'use strict';

var should  = require('should')
  , Buddycloud = require('../../index')
  , helper  = require('../helper')

/* jshint -W030 */
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
        buddycloud.channelServer = 'chanels.example.com'
    })

    it('Parses entry XML to expected format', function(done) {

            var payload = {
                form: [
                    { var: 'content', value: 'test' }
                ]
            }
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('search-response'))
            })
            var callback = function(error, data) {
                should.not.exist(error)

                var fields = data.fields
                fields.node.should.eql({
                    label: 'Node',
                    type: 'text-single'
                })
                fields.id.should.eql({
                    label: 'Item ID',
                    type: 'text-single'
                })
                fields.entry.should.eql({
                    label: 'Item',
                    type: 'xml'
                })

                data.results.length.should.equal(2)
                var results = data.results

                results[0].node.should.equal('/user/romeo@montague.lit/posts')
                results[0].id.should.equal('5w382609806986536982502859083409')
                results[0].entry.body.should.equal('Hello World')

                results[1].node.should.equal('/user/juliet@capulet.lit/posts')
                results[1].id.should.equal('fg455g542hg4hhtfgh4554hg5g5g54h4F')
                results[1].entry.body.should.equal('Hello Everyone')

                done()
            }
            socket.emit('xmpp.buddycloud.search.do', payload, callback)
        })

})
