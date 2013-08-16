var builder    = require('ltx'),
    PubSub     = require('xmpp-ftw-pubsub'),
    Presence   = require('xmpp-ftw/lib/presence'),
    dataForm   = require('xmpp-ftw/lib/utils/xep-0004'),
    Disco      = require('xmpp-ftw-disco'),
    Register   = require('xmpp-ftw-register')
    async      = require('async')
    rsm        = require('xmpp-ftw/lib/utils/xep-0059')

var Buddycloud = function() {
    this.itemParser
    this.channelServer
    this.disco = new Disco()
    this.presence = new Presence()
    this.register = new Register()
    
    this.discoveryTimeout = this.DISCO_RESPONSE_TIMEOUT
    this.maxRecentItemsPerChannel = 30
}

Buddycloud.prototype.__proto__ = PubSub.prototype

var init = Buddycloud.prototype.init

Buddycloud.prototype.init = function(manager) {
    init.call(this, manager)
    this.disco.init(manager, true)
    this.presence.init(manager, true)
    this.register.init(manager, true)
}

Buddycloud.prototype.NS_BUDDYCLOUD = 'http://buddycloud.org/v1'
Buddycloud.prototype.DISCO_RESPONSE_TIMEOUT = 8000

Buddycloud.prototype.setDiscoveryTimeout = function(timeout) {
    this.discoveryTimeout = timeout
    return this
}

Buddycloud.prototype.registerEvents = function() {
    var self = this
    this.socket.on('xmpp.buddycloud.discover', function(data, callback) {
        self.discover(data, callback)
    })
    this.socket.on('xmpp.buddycloud.register', function(data, callback) {
      if (!self._checkCall(data, callback)) return
      return self.register.set(data, callback)
    })

    this.socket.on('xmpp.buddycloud.presence', function() {
        if (!self._checkCall({}, null, true)) return
        self.presence.sendPresence({
            to: self.channelServer,
            priority: -1,
            status: 'buddycloud',
            show: 'online'
        })
    })
    this.socket.on('xmpp.buddycloud.create', function(data, callback) {
        if (!self._checkCall(data, callback)) return
        self.createNode(data, callback)
    })
    this.socket.on('xmpp.buddycloud.publish', function(data, callback) {
        if (!self._checkCall(data, callback)) return
        self.publish(data, callback)
    })
    this.socket.on('xmpp.buddycloud.retrieve', function(data, callback) {
        if (!self._checkCall(data, callback)) return
        var done = function(error, items, rsm) {
            if (error) return callback(error)
            for (var i = 0; i < items.length; i++)
                items[i].node = data.node
            callback(error, items, rsm)
        }
        self.getItems(data, done)
    })
    this.socket.on('xmpp.buddycloud.items.recent', function(data, callback) {
        if (!self._checkCall(data, callback)) return
        self.getRecentItems(data, callback)
    })
    this.socket.on('xmpp.buddycloud.items.replies', function(data, callback) {
        if (!self._checkCall(data, callback)) return
        self.getItemSet(data, callback, 'replies')
    })
    this.socket.on('xmpp.buddycloud.items.thread', function(data, callback) {
        if (!self._checkCall(data, callback)) return
        self.getItemSet(data, callback, 'thread')
    })
    this.socket.on('xmpp.buddycloud.item.delete', function(data, callback) {
        if (!self._checkCall(data, callback)) return
        self.deleteItem(data, callback)
    })
    this.socket.on('xmpp.buddycloud.subscribe', function(data, callback) {
        if (!self._checkCall(data, callback)) return
        delete(data.jid) 
        self.subscribe(data, callback)
    })
    this.socket.on('xmpp.buddycloud.unsubscribe', function(data, callback) {
        if (!self._checkCall(data, callback)) return
        delete(data.jid)
        self.unsubscribe(data, callback)
    })
    this.socket.on('xmpp.buddycloud.subscription', function(data, callback) {
        if (!self._checkCall(data, callback)) return
        self.setSubscription(data, callback)
    })
    this.socket.on('xmpp.buddycloud.config.set', function(data, callback) {
        if (!self._checkCall(data, callback)) return
        self.setNodeConfiguration(data, callback)
    })
    this.socket.on('xmpp.buddycloud.config.get', function(data, callback) {
        if (!self._checkCall(data, callback)) return
        if (data.owner) return self.getNodeConfiguration(data, callback) 
        self.getNodeInformation(data, callback)
    })
    this.socket.on('xmpp.buddycloud.subscriptions', function(data, callback) {
        if (!self._checkCall(data, callback)) return
        self.getSubscriptions(data, callback)
    })
    this.socket.on('xmpp.buddycloud.affiliations', function(data, callback) {
        if (!self._checkCall(data, callback)) return
        self.getAffiliations(data, callback)
    })
    this.socket.on('xmpp.buddycloud.affiliation', function(data, callback) {
        if (!self._checkCall(data, callback)) return
        self.setAffiliation(data, callback)
    })
    this.socket.on('xmpp.buddycloud.discover.items', function(data, callback) {
        self.disco.getItems(data, callback)
    })
    this.socket.on('xmpp.buddycloud.discover.info', function(data, callback) {
        self.disco.getFeatures(data, callback)
    })
}

Buddycloud.prototype.handles = function(stanza) {
    if (!this.channelServer || (stanza.attrs.from != this.channelServer))
        return false
    return PubSub.prototype.handles(stanza)
}

Buddycloud.prototype.handle = function(stanza) {
    if (null != stanza.getChild('event', this.NS_EVENT)) 
        return this._eventNotification(stanza)
    return this._handleSubscriptionAuthorisation(stanza)
}

Buddycloud.prototype._checkCall = function(data, callback, skipCallback) {
    if (!data) return this._clientError('Missing payload', data, callback)
    if (!skipCallback && (typeof callback !== 'function')) {
        this._clientError('Missing callback', data) 
        return false
    }
    if (!this.channelServer) {
        this._clientError(
            'You must perform discovery first!', data, callback
        )
        return false
    }
    data.to = this.channelServer
    return true
}

Buddycloud.prototype.discover = function(data, callback) {
    var self = this
    if (typeof callback !== 'function')
        return this._clientError('Missing callback', data)
    var request = { of: this.manager.jid.split('@')[1] }
    this.disco.getItems(request, function(error, items) {
        if (error) return callback(error)
        var jobs = {}
        items.forEach(function(item) {
            jobs[item.jid] = function(infoCallback) {
                var callbackMade = false
                var timeout = setTimeout(function() {
                    callbackMade = true
                    infoCallback(null, [])
                }, self.discoveryTimeout)
                var request = { of: item.jid }
                self.disco.getFeatures(request, function(error, features) {
                    clearTimeout(timeout)
                    if (error) features = []
                    if (false === callbackMade) {
                        callbackMade = true
                        infoCallback(null, features)
                    }
                })
            }
        })
        async.parallel(jobs, function(error, results) {
            var discovered = false
            if (error) return callback(error)
            for (var i in results) {
                results[i].forEach(function(feature) {
                    if (('identity' == feature.kind)
                        && (feature.category && 'pubsub' == feature.category)
                        && (feature.type && 'channels' == feature.type)) {
                        self.channelServer = i
                        discovered = true
                        return callback(null, i)
                    }
                })
            }
            if (false == discovered)
                return callback('No buddycloud server found')
        })
    })
}

Buddycloud.prototype._purgeNodeNotification = function(stanza, purge) {
    var data = { node: purge.attrs.node }
    this.socket.emit('xmpp.buddycloud.push.purge', data)
    return true
}

Buddycloud.prototype._itemDeleteNotification = function(stanza, items) {
    var data = {}
    this._getItemData(items, data, 'retract')
    this._getHeaderData(stanza, data)
    this.socket.emit('xmpp.buddycloud.push.retract', data)
    return true
}

Buddycloud.prototype._itemNotification = function(stanza, items) {
    var data = {}
    this._getItemData(items, data)
    if (stanza.getChild('headers'))
        this._getHeaderData(stanza, data)
    if (stanza.getChild('delay'))
        data.delay = stanza.getChild('delay').attrs.stamp
    this.socket.emit('xmpp.buddycloud.push.item', data)
    return true
}

Buddycloud.prototype._configurationUpdate = function(stanza, configuration) {
    var data = {}
    this._getConfigurationChanges(configuration, data)
    this.socket.emit('xmpp.buddycloud.push.configuration', data)
    return true
}

Buddycloud.prototype._deleteNodeNotification = function(stanza, del) {
    var data = {}
    this._getDeleteNodeNotification(del, data)
    this.socket.emit('xmpp.buddycloud.push.delete', data)
    return true
}

Buddycloud.prototype.getRecentItems = function(data, callback) {
    var self = this
    var max = (null == data.max) ? this.maxRecentItemsPerChannel : data.max
    var since = (null == data.since) ? 0 : data.since
    var since = Date.parse(since)
    var stanza = this._getStanza({ to: data.to }, 'get', 'recent-items')
    if (true == isNaN(since))
        return this._clientError('Recent date was unparsable', data, callback)
    stanza.attrs = {
        xmlns: this.NS_BUDDYCLOUD,
        max: max,
        since: new Date(since).toISOString()
    }
    if (data.rsm) rsm.build(stanza.root().getChild('pubsub'), data.rsm)

    this.manager.trackId(stanza.root().attr('id'), function(stanza) {
        if ('error' == stanza.attrs.type)
            return callback(self._parseError(stanza))
        var recentItems = []
        stanza.getChild('pubsub').getChildren('items').forEach(function(items) {
            var node = items.attrs.node
            items.getChildren('item').forEach(function(item) {
                recentItems.push({
                    id: item.attrs.id,
                    node: node,
                    entry: self._getItemParser().parse(item)
                })
            })
        })
        callback(
            null,
            recentItems,
            rsm.parse(stanza.root().getChild('pubsub'))
        )
    })
    this.client.send(stanza)   
}

Buddycloud.prototype.getItemSet = function(data, callback, type) {
    if (!data.node)
        return this._clientError('Missing \'node\' key', data, callback)
    if (!data.id) 
        return this._clientError("Missing 'id' key", data, callback)
    var self = this
    var stanza = this._getStanza({ to: data.to }, 'get', type)
    stanza.attrs = {
        xmlns: this.NS_BUDDYCLOUD,
        node: data.node,
        item_id: data.id
    }
    if (data.rsm) rsm.build(stanza.root().getChild('pubsub'), data.rsm)
    this.manager.trackId(stanza.root().attr('id'), function(stanza) {
        if ('error' == stanza.attrs.type)
            return callback(self._parseError(stanza))
        var replies = []
        var items = stanza.getChild('pubsub')
            .getChild('items')
            .getChildren('item')
        items.forEach(function(item) {
            replies.push({
                id: item.attrs.id,
                entry: self._getItemParser().parse(item),
                node: data.node
            })
        })
        callback(
            null,
            replies,
            rsm.parse(stanza.root().getChild('pubsub'))
        )
    })
    this.client.send(stanza)   
}

Buddycloud.prototype.getNodeInformation = function(data, callback) {
    var self = this
    if (!data.node)
        return this._clientError('Missing \'node\' key', data, callback)
    var request = { of: data.to, node: data.node }
    this.disco.getFeatures(request, function(error, features) {
        if (error) return callback(error)
        var done = false
        features.some(function(feature) {
            if ('form' == feature.kind) {
                done = true
                return callback(null, feature.form.fields)
            }
        })
        if (false === done) 
            self._clientError('No node information found', data, callback)
    })   
}

Buddycloud.prototype._handleSubscriptionAuthorisation = function(stanza) {
    var data = { id: stanza.attrs.id }
    this._handleAuthorisationRequest(
        data,
        stanza,
        'xmpp.buddycloud.push.authorisation'
    )
}

Buddycloud.prototype._affiliationUpdate = function(stanza, affiliations) {
    var data = {}
    this._getAffiliationUpdate(affiliations, data)
    this.socket.emit('xmpp.buddycloud.push.affiliation', data)
    return true
}

Buddycloud.prototype._subscriptionUpdate = function(stanza, subscription) {
    var data = {}
    this._getSubscriptionUpdate(subscription, data)
    this.socket.emit('xmpp.buddycloud.push.subscription', data) 
    return true
}

module.exports = Buddycloud
