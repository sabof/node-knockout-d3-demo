/*jshint node:true */
/*global unescape */

// API:
// prices/SUBSECTOR
// weights/DATE
// sectors

var fs = require('fs'),
    http = require('http'),
    path = require("path"),
    url = require("url"),
    sys = require('sys'),
    repl = require("repl");

var sources = {
  weights: require('./data/weights.json'),
  subsectorToSectorMap: require('./data/SubsectorToSectorMap.json'),
  prices_for_subsectors: require('./data/prices_for_subsectors.json')
};

// Data processing

sources.weights.forEach(function(it) {
  it.Date = Date.parse(it.Date);
});

var weightDates = (function() {
  var dates = {};
  sources.weights.forEach(function(weight) {
    if (weight.Date) {
      dates[weight.Date] = true;
    }
  });
  return Object.keys(dates)
    .sort(function(a, b) {
      return a - b;
    });
}());

function getDateWeights(date) {
  var clean = sources.weights.filter(function(it) {
    return it.Date == date;
  });
  var result = {};
  clean.forEach(function(it) {
    result[it.SubSector] = it;
  });
  return result;
}

// Serving

function serveJSON(res, object) {
  res.writeHead(200, {
    'Content-Type': 'application/json'
  });
  res.end(JSON.stringify(object));
}

function serve404(res) {
  res.writeHead(404, {
		"Content-Type": "text/plain"
	});
	res.end("404 Not Found\n");
}

var sectorMap = (function() {
  var map = {
    name: 'root',
    children: []
  },
      sectorMapRaw = sources.subsectorToSectorMap;

  function getSectorCreate(sectorName) {
    var object;

    map.children.some(function(it) {
      if (it.name === sectorName) {
        object = it;
        return true;
      }
    });

    if (! object) {
      object = {
        name: sectorName,
        children: []
      };
      map.children.push(object);
    }

    return object;
  }

  for (var subsectorName in sectorMapRaw) {
    if (sectorMapRaw.hasOwnProperty(subsectorName)) {
      var sectorName = sectorMapRaw[subsectorName];
      var sector = getSectorCreate(sectorName);

      sector.children.push({
        name: subsectorName
      });
    }
  }

  return map;
}());

// Request handling

function handleAPIRequest(req, res) {
  /*jshint boss:true */
  var matches, obj;

  if (/^\/api\/initialPayload\/?/.test(req.url)) {
    serveJSON(res, {
      sectors: sectorMap,
      dates: weightDates,
      initialDate: weightDates[0],
      initialData: getDateWeights(weightDates[0])
    });
    return;
  } else if (matches = req.url.match(/^\/api\/weights\/([^\/]+)/)) {
    // FIXME: Cache?
    obj = getDateWeights(matches[1]);
    if (obj) {
      serveJSON(res, obj);
      return;
    }

  } else if (matches = req.url.match(/^\/api\/prices\/([^\/]+)/)) {
    obj = sources.prices_for_subsectors[unescape(matches[1])];
    if (obj) {
      serveJSON(res, obj);
      return;
    }
  }

  serve404(res);
}

function handleFileRequest(req, res) {
  var uri = url.parse(req.url).pathname,
      filename = path.join(process.cwd(), 'frontend', uri);

  fs.exists(filename, function(exists) {
    if (!exists) {
      serve404(res);
      return;
    }

    if (fs.statSync(filename).isDirectory()) filename += '/index.html';

    fs.readFile(filename, "binary", function(err, file) {
      if (err) {
        res.writeHead(500, {"Content-Type": "text/plain"});
        res.write(err + "\n");
        res.end();
        return;
      }

      res.writeHead(200);
      res.write(file, "binary");
      res.end();
    });
  });
}

var server = http.createServer(function(req, res) {
  if (/^\/api\//.test(req.url)) {
    handleAPIRequest(req, res);
  } else {
    handleFileRequest(req, res);
  }
});

server.listen(8124, "127.0.0.1");
