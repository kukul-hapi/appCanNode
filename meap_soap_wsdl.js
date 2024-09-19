
var WSDL = function (definition, uri, options) {
    var self = this,
        fromFunc;

    this.uri = uri;
    this.callback = function () {
    };
    this.options = options || {};

    if (typeof definition === 'string') {
        fromFunc = this._fromXML;
    } else if (typeof definition === 'object') {
        fromFunc = this._fromServices;
    } else {
        throw new Error('WSDL constructor takes either an XML string or service definition');
    }

    process.nextTick(function () {
        fromFunc.call(self, definition);

        self.processIncludes(function (err) {
            var name;
            if (err) {
                return self.callback(err);
            }

            self.definitions.deleteFixedAttrs();
            var services = self.services = self.definitions.services;
            if (services) {
                for (name in services) {
                    services[name].postProcess(self.definitions);
                }
            }
            var complexTypes = self.definitions.complexTypes;
            if (complexTypes) {
                for (name in complexTypes) {
                    complexTypes[name].deleteFixedAttrs();
                }
            }

            // for document style, for every binding, prepare input message element name to (methodName, output message element name) mapping
            var bindings = self.definitions.bindings;
            for (var bindingName in bindings) {
                var binding = bindings[bindingName];
                if (binding.style === 'rpc')
                    continue;
                var methods = binding.methods;
                var topEls = binding.topElements = {};
                for (var methodName in methods) {
                    var inputName = methods[methodName].input ? methods[methodName].input.$name : null;
                    var outputName = methods[methodName].output ? methods[methodName].output.$name : null;
                    topEls[inputName] = {"methodName": methodName, "outputName": outputName};
                }
            }

            // prepare soap envelope xmlns definition string
            self.xmlnsInEnvelope = self._xmlnsMap();

            self.callback(err, self);
        });

    });
};

WSDL.prototype.onReady = function (callback) {
    if (callback)
        this.callback = callback;
};

WSDL.prototype._processNextInclude = function (includes, callback) {
    var self = this,
        include = includes.shift();

    if (!include)
        return callback();

    var includePath;
    if (!/^http/.test(self.uri) && !/^http/.test(include.location)) {
        includePath = path.resolve(path.dirname(self.uri), include.location);
    } else {
        includePath = url.resolve(self.uri, include.location);
    }

    open_wsdl(includePath, function (err, wsdl) {
        if (err) {
            return callback(err);
        }
        if (self.definitions.schemas[include.namespace || wsdl.definitions.$targetNamespace])
            self.definitions.schemas[include.namespace || wsdl.definitions.$targetNamespace] = wsdl.definitions;
        else {
            if (Object.keys(self.definitions.messages) == 0 && Object.keys(wsdl.definitions.messages))
                self.definitions.messages = wsdl.definitions.messages;
            if (Object.keys(self.definitions.portTypes) == 0 && Object.keys(wsdl.definitions.portTypes))
                self.definitions.portTypes = wsdl.definitions.portTypes;
            if (Object.keys(self.definitions.schemas) == 0 && Object.keys(wsdl.definitions.schemas))
                self.definitions.schemas = wsdl.definitions.schemas;
        }
        self._processNextInclude(includes, function (err) {
            callback(err);
        });
    });
};

WSDL.prototype.processIncludes = function (callback) {
    var schemas = this.definitions.schemas,
        includes = [];

    for (var ns in schemas) {
        var schema = schemas[ns];
        includes = includes.concat(schema.includes || []);
    }
    includes = includes.concat(this.definitions.includes || [])

    this._processNextInclude(includes, callback);
};

WSDL.prototype.describeServices = function () {
    var services = {};
    for (var name in this.services) {
        var service = this.services[name];
        services[name] = service.description(this.definitions);
    }
    return services;
};

WSDL.prototype.toXML = function () {
    return this.xml || '';
};

WSDL.prototype.xmlToObject = function (xml) {
    var self = this;
    var p = new expat.Parser('UTF-8');
    var objectName = null;
    var root = {};
    var schema = {
        Envelope: {
            Header: {
                Security: {
                    UsernameToken: {
                        Username: 'string',
                        Password: 'string'
                    }
                }
            },
            Body: {
                Fault: {
                    faultcode: 'string',
                    faultstring: 'string',
                    detail: 'string'
                }
            }
        }
    };
    var stack = [{name: null, object: root, schema: schema}];

    var refs = {}, id; // {id:{hrefs:[],obj:}, ...}

    p.on('startElement', function (nsName, attrs) {

        var name = splitNSName(nsName).name,
            attributeName,
            top = stack[stack.length - 1],
            topSchema = top.schema,
            elementAttributes = {},
            hasNonXmlnsAttribute = false,
            obj = {};
        var originalName = name;

        if (!objectName && top.name === 'Body' && name !== 'Fault') {
            var message = self.definitions.messages[name];
            // Support RPC/literal messages where response body contains one element named
            // after the operation + 'Response'. See http://www.w3.org/TR/wsdl#_names
            if (!message) {
                // Determine if this is request or response
                var isInput = false;
                var isOutput = false;
                if ((/Response$/).test(name)) {
                    isOutput = true;
                    name = name.replace(/Response$/, '');
                } else if ((/Request$/).test(name)) {
                    isInput = true;
                    name = name.replace(/Request$/, '');
                } else if ((/Solicit$/).test(name)) {
                    isInput = true;
                    name = name.replace(/Solicit$/, '');
                }
                // Look up the appropriate message as given in the portType's operations
                var portTypes = self.definitions.portTypes;
                var portTypeNames = Object.keys(portTypes);
                // Currently this supports only one portType definition.
                var portType = portTypes[portTypeNames[0]];
                if (!portType.methods[name]) {
                    for (var i in portType.methods) {
                        name = i;
                        break;
                    }
                }
                try {
                    if (isInput)
                        name = portType.methods[name].input.$name;
                    else
                        name = portType.methods[name].output.$name;
                } catch (e) {
                    _ERROR("[meap_soap_wsdl][WSDL][xmlToObject][ERROR]:Response Method Name is error");
                }
                message = self.definitions.messages[name];
                // 'cache' this alias to speed future lookups
                self.definitions.messages[originalName] = self.definitions.messages[name];
            }

            topSchema = message.description(self.definitions);
            objectName = originalName;
        }

        if (attrs.href) {
            id = attrs.href.substr(1);
            if (!refs[id])
                refs[id] = {hrefs: [], obj: null};
            refs[id].hrefs.push({par: top.object, key: name, obj: obj});
        }
        if (id = attrs.id) {
            if (!refs[id])
                refs[id] = {hrefs: [], obj: null};
        }

        //Handle element attributes
        for (attributeName in attrs) {
            if (/^xmlns:?/.test(attributeName)) continue;
            hasNonXmlnsAttribute = true;
            elementAttributes[attributeName] = attrs[attributeName];
        }

        if (hasNonXmlnsAttribute) obj.attributes = elementAttributes;

        if (topSchema && topSchema[name + '[]'])
            name = name + '[]';
        stack.push({name: originalName, object: obj, schema: topSchema && topSchema[name], id: attrs.id});
    });

    p.on('endElement', function (nsName) {
        var cur = stack.pop(),
            obj = cur.object,
            top = stack[stack.length - 1],
            topObject = top.object,
            topSchema = top.schema,
            name = splitNSName(nsName).name;

        if (topSchema && topSchema[name + '[]']) {
            if (!topObject[name])
                topObject[name] = [];
            topObject[name].push(obj);
        } else if (name in topObject) {
            if (!Array.isArray(topObject[name])) {
                topObject[name] = [topObject[name]];
            }
            topObject[name].push(obj);
        } else {
            topObject[name] = obj;
        }

        if (cur.id) {
            refs[cur.id].obj = obj;
        }
    });

    p.on('text', function (text) {
        text = trim(text);
        if (!text.length)
            return;

        var top = stack[stack.length - 1];
        var name = splitNSName(top.schema).name,
            value;
        if (name === 'int' || name === 'integer') {
            value = parseInt(text, 10);
        } else if (name === 'bool' || name === 'boolean') {
            value = text.toLowerCase() === 'true' || text === '1';
        } else if (name === 'dateTime') {
            value = new Date(text);
        } else {
            // handle string or other types
            if (typeof top.object !== 'string') {
                value = text;
            } else {
                value = top.object + text;
            }
        }
        top.object = value;
    });

    if (!p.parse(xml, false)) {
        throw new Error(p.getError());
    }
    // merge obj with href
    var merge = function (href, obj) {
        for (var j in obj) {
            if (obj.hasOwnProperty(j)) {
                href.obj[j] = obj[j];
            }
        }
    };

    // MultiRef support: merge objects instead of replacing
    for (var n in refs) {
        var ref = refs[n];
        for (var i = 0; i < ref.hrefs.length; i++) {
            merge(ref.hrefs[i], ref.obj);
        }

    }

    var body = root.Envelope.Body;
    if (body.Fault) {
        var error = new Error(body.Fault.faultcode + ': ' + body.Fault.faultstring + (body.Fault.detail ? ': ' + body.Fault.detail : ''));
        error.root = root;
        throw error;
    }
    return root.Envelope;
};

WSDL.prototype.findParameterObject = function (xmlns, parameterType) {
    if (!xmlns || !parameterType) {
        return null;
    }

    var parameterTypeObj = null;

    if (this.definitions.schemas) {
        var schema = this.definitions.schemas[xmlns];
        if (schema) {
            if (parameterType.indexOf(':') !== -1) {
                parameterType = parameterType.substring(parameterType.indexOf(':') + 1, parameterType.length);
            }

            parameterTypeObj = schema.complexTypes[parameterType];
        }
    }

    return parameterTypeObj;
};

WSDL.prototype.objectToDocumentXML = function (name, params, ns, xmlns, type) {
    var args = {};
    args[name] = params;
    var parameterTypeObj = type ? this.findParameterObject(xmlns, type) : null;
    return this.objectToXML(args, null, ns, xmlns, true, null, parameterTypeObj);
};

WSDL.prototype.objectToRpcXML = function (name, params, namespace, xmlns) {
    var self = this;
    var parts = [];
    var defs = this.definitions;
    var nsAttrName = '_xmlns';

    namespace = namespace || findKey(defs.xmlns, xmlns);
    xmlns = xmlns || defs.xmlns[namespace];
    namespace = namespace === 'xmlns' ? '' : (namespace + ':');
    parts.push(['<', namespace, name, '>'].join(''));

    for (var key in params) {
        if (key !== nsAttrName) {
            var value = params[key];
            parts.push(['<', key, '>'].join(''));
            parts.push((typeof value === 'object') ? this.objectToXML(value) : xmlEscape(value));
            parts.push(['</', key, '>'].join(''));
        }
    }
    parts.push(['</', namespace, name, '>'].join(''));

    return parts.join('');
};

WSDL.prototype.objectToXML = function (obj, name, namespace, xmlns, first, xmlnsAttr, parameterTypeObject, ancestorXmlns) {
    var self = this;
    var parts = [];

    var xmlnsAttrib = "";/*first
    ? ((namespace !== 'xmlns' ? ' xmlns:' + namespace + '="' + xmlns + '"' : '') + ' xmlns="' + xmlns + '"')
    : '';*/

    var ancXmlns = first ? new Array(xmlns) : ancestorXmlns;

    // explicitly use xmlns attribute if available
    if (xmlnsAttr) {
        xmlnsAttrib = xmlnsAttr;
    }

    var ns = namespace && namespace !== 'xmlns' ? namespace + ':' : '';

    if (Array.isArray(obj)) {
        for (var i = 0, item; item = obj[i]; i++) {
            if (i > 0) {
                parts.push(['</', ns, name, '>'].join(''));
                parts.push(['<', ns, name, xmlnsAttrib, '>'].join(''));
            }
            parts.push(self.objectToXML(item, name, namespace, xmlns));
        }
    } else if (typeof obj === 'object') {
        for (name in obj) {
            //don't process attributes as element
            if (name === 'attributes') {
                continue;
            }

            var child = obj[name];
            var attr = self.processAttributes(child);
            parts.push(['<', ns, name, attr, xmlnsAttrib, '>'].join(''));

            if (first) {
                parts.push(self.objectToXML(child, name, null, xmlns, false, null, parameterTypeObject, ancXmlns));
            } else {

                if (self.definitions.schemas) {
                    var schema = this.definitions.schemas[xmlns];
                    if (schema) {

                        var childParameterTypeObject = self.findChildParameterObject(parameterTypeObject, name);
                        if (childParameterTypeObject) {
                            var childParameterType = childParameterTypeObject.$type;

                            var childNamespace = '';
                            if (childParameterType.indexOf(':') !== -1) {
                                childNamespace = childParameterType.substring(0, childParameterType.indexOf(':'));
                            }
                            var childXmlns = schema.xmlns[childNamespace];
                            var childXmlnsAttrib = ' xmlns:' + childNamespace + '="' + childXmlns + '"';
                            if (ancXmlns.indexOf(childXmlns) !== -1) {
                                childXmlnsAttrib = '';
                            } else {
                                ancXmlns.push(childXmlns);
                            }

                            if (!childXmlns) childXmlns = xmlns;
                            parts.push(self.objectToXML(child, name, null, childXmlns, false, null, childParameterTypeObject));
                            // if(parts.length>1  && childXmlnsAttrib!= null && childXmlnsAttrib!="")
                            // {
                            // parts[0] = ['<', ns, name, attr, childXmlnsAttrib, '>'].join('');
                            // }
                        } else {
                            parts.push(self.objectToXML(child, name, namespace, xmlns));
                        }
                    }
                }

            }
            parts.push(['</', ns, name, '>'].join(''));
        }
    } else if (obj !== undefined) {
        parts.push(xmlEscape(obj));
    }
    return parts.join('');
};

WSDL.prototype.processAttributes = function (child) {
    var attr = '';
    if (child.attributes) {
        for (var attrKey in child.attributes) {
            attr += ' ' + attrKey + '="' + xmlEscape(child.attributes[attrKey]) + '"';
        }
    }

    return attr;
};

WSDL.prototype.findChildParameterObject = function (parameterTypeObj, childName) {
    if (!parameterTypeObj || !childName) {
        return null;
    }

    var object = parameterTypeObj;
    if (object.$name === childName) {
        return object;
    }

    if (object.children) {
        for (var i = 0, child; child = object.children[i]; i++) {
            var found = this.findChildParameterObject(child, childName);
            if (found) {
                return found;
            }
        }
    }

    return null;
};

WSDL.prototype._parse = function (xml) {
    var self = this,
        p = new expat.Parser('UTF-8'),
        stack = [],
        root = null;

    p.on('startElement', function (nsName, attrs) {

        var top = stack[stack.length - 1];
        var name;
        if (top) {
            try {
                top.startElement(stack, nsName, attrs);
            } catch (e) {
                if (self.options.strict) {
                    throw e;
                } else {
                    stack.push(new Element(nsName, attrs));
                }
            }
        } else {
            name = splitNSName(nsName).name;
            if (name === 'definitions') {
                root = new DefinitionsElement(nsName, attrs);
            } else if (name === 'schema') {
                root = new SchemaElement(nsName, attrs);
            } else {
                throw new Error('Unexpected root element of WSDL or include');
            }
            stack.push(root);
        }
    });

    p.on('endElement', function (name) {
        var top = stack[stack.length - 1];
        assert(top, 'Unmatched close tag: ' + name);

        top.endElement(stack, name);
    });

    if (!p.parse(xml, false)) {
        throw new Error(p.getError());
    }

    return root;
};

WSDL.prototype._fromXML = function (xml) {
    this.definitions = this._parse(xml);
    this.xml = xml;
};

WSDL.prototype._fromServices = function (services) {

};


WSDL.prototype._xmlnsMap = function () {
    var xmlns = this.definitions.xmlns;
    var str = '';
    for (var alias in xmlns) {
        if (alias === '' || alias === 'xmlns')
            continue;
        var ns = xmlns[alias];
        switch (ns) {
            case "http://xml.apache.org/xml-soap" : // apachesoap
            case "http://schemas.xmlsoap.org/wsdl/" : // wsdl
            case "http://schemas.xmlsoap.org/wsdl/soap/" : // wsdlsoap
            case "http://schemas.xmlsoap.org/soap/encoding/" : // soapenc
            case "http://www.w3.org/2001/XMLSchema" : // xsd
                continue;
        }
        if (~ns.indexOf('http://schemas.xmlsoap.org/'))
            continue;
        if (~ns.indexOf('http://www.w3.org/'))
            continue;
        if (~ns.indexOf('http://xml.apache.org/'))
            continue;
        if (alias == 'tns' && ns.indexOf('http://cttq.org/') > -1) alias = 'cttq';
        if (alias == 'tns' && ns.indexOf('http://ws.ucfgroup.com/') > -1) alias = 'ws';
        str += ' xmlns:' + alias + '="' + ns + '"';
    }
    return str;
};

function open_wsdl(uri, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    var request_headers = options.wsdl_headers;
    var request_options = options.wsdl_options;

    delete options.wsdl_headers;
    delete options.wsdl_options;

    var wsdl;
    if (!/^http/.test(uri)) {
        fs.readFile(uri, 'utf8', function (err, definition) {
            if (err) {
                callback(err);
            } else {
                wsdl = new WSDL(definition, uri, options);
                wsdl.onReady(callback);
            }
        });
    } else {
        http.request(uri, null /* options */, function (err, response, definition) {
            if (err) {
                callback(err);
            } else if (response && response.statusCode === 200) {
                wsdl = new WSDL(definition, uri, options);
                wsdl.onReady(callback);
            } else {
                callback(new Error('Invalid WSDL URL: ' + uri + "\n\n\r Code: " + response.statusCode + "\n\n\r Response Body: " + response.body));
            }
        }, request_headers, request_options);
    }

    return wsdl;
}

exports.open_wsdl = open_wsdl;
exports.WSDL = WSDL;
