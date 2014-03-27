/*global ko, d3*/

(function () {
  var utils = {
    getClosestMatch: function(value, candidates) {
      var bestScore = Number.MAX_VALUE,
          bestValue;

      // FIXME: Can be optimized, so iteration stops when values start getting worse.
      candidates.forEach(function(candidate) {
        var currentScore = Math.abs(candidate - value);
        if (currentScore < bestScore) {
          bestScore = currentScore;
          bestValue = candidate;
        }
      });
      return bestValue;
    },

    getNext: function(current, values) {
      var index = values.indexOf(current);
      if (index === -1) {
        return;
      }
      return values[index + 1];
    },

    makeCounterFunc: function(times, endFunc) {
      return function() {
        if (--times === 0) {
          return endFunc();
        }
      };
    }
  };

  var model = {
    fetchWeights: function(date) {
      // FIXME: Allows concurrent requests to the same resource?
      var self = this;
      if (this.weights()[date]) {
        return;
      }
      d3.json(
        'api/weights/' + date,
        function(error, data) {
          self.weights()[date] = data;
          self.weights.valueHasMutated();
        });
    },

    fetchAllWeights: function() {
      if (this.allWeightsFetched()) {
        return;
      }

      var self = this;
      d3.json(
        'api/allWeights/',
        function(error, data) {
          self.weights(data);
        });

    },

    _initBindings: function() {
      var self = this;

      this.allowedDates = ko.observable([]);
      this.weights = ko.observable({});
      this.initialDate = ko.observable();
      this.sectorMap = ko.observable({});
      this.dataInitialized = ko.observable();

      this.allWeightsFetched = ko.computed(function() {
        var allowedDates = self.allowedDates().length;
        var weights = Object.keys(self.weights()).length;

        return allowedDates &&
          weights &&
          allowedDates === weights;
      });

      this.minDate = ko.computed(function() {
        return self.allowedDates()[0] || null;
      });

      this.maxDate = ko.computed(function() {
        var dates = self.allowedDates();
        return dates[dates.length - 1] || null;
      });

    },

    _fetchInitialPayload: function() {
      var self = this;
      d3.json(
        'api/initialPayload/',
        function(error, data) {
          self.allowedDates(data.dates);

          var weights = self.weights();
          weights[data.initialDate] = data.initialData;
          self.weights.valueHasMutated();

          self.initialDate(data.initialDate);
          self.sectorMap(data.sectors);
          self.dataInitialized(true);
        }
      );
    },

    init: function() {
      this._initBindings();
      this._fetchInitialPayload();
    }

  };

  var view = {
    model: model,

    animationNext: function() {
      if (! this.animationInProgress()) {
        return;
      }
      var nextDate = utils.getNext(
        this.currentDate(), model.allowedDates()
      );
      if (nextDate) {
        this.currentDate(nextDate);
      } else {
        this.animationInProgress(false);
      }
    },

    _initBindings: function() {
      var self = this;

      this.animationInProgress = ko.observable();

      this.animationInProgress.subscribe(function(val) {
        if (val) {
          self.model.fetchAllWeights();
          if (self.currentDate() == self.model.maxDate()) {
            self.currentDate(self.model.minDate());
          }
        }
      });

      this.animationToggleOnClick = function() {
        self.animationInProgress(
          ! self.animationInProgress()
        );
      };

      this.sliderValue = ko.observable();

      this.sliderMin = this.model.minDate;
      this.sliderMax = this.model.maxDate;

      this.sliderDisabled = ko.computed(function() {
        return self.animationInProgress() || ! self.model.dataInitialized();
      });

      this.lastAvailableDate = ko.observable();

      this.currentDate = ko.computed({
        read: function() {
          var sliderValue = self.sliderValue();
          var allowedDates = self.model.allowedDates();
          if (! (sliderValue && allowedDates)) {
            return;
          }

          var newVal =  utils.getClosestMatch(
            sliderValue, allowedDates
          );

          self.model.fetchWeights(newVal);
          return newVal;
        },
        write: self.sliderValue
      });

      this.currentDate.subscribe(function(oldValue) {
        if (self.model.weights()[oldValue]) {
          self.lastAvailableDate(oldValue);
        }
      }, null, 'beforeChange');

      this.model.initialDate.subscribe(function(newValue) {
        self.currentDate(newValue);
      });

      this.displayedWeightData = ko.computed(function() {
        var current = self.currentDate();
        var previous = self.lastAvailableDate();
        var weights = self.model.weights();

        return weights[current] ||
          weights[previous] ||
          false;
      });

      this.dateLabel = ko.computed(function() {
        var current = self.currentDate();
        if (! current) {
          return;
        }
        return (new Date(Number(current)))
          .toISOString()
          .match(/^[^T]+/)[0];
      });
    },

    init: function() {
      this._initBindings();
    }
  };

  // D3
  var d3View = {
    view: view,

    update: function() {
      var transition;

      this.node.data(this.treemap.nodes);
      if (! this.animationInProgress()) {
        transition = this.node
          .transition()
          .duration(1000)
          .call(this._position);

      } else {
        transition = this.node
          .transition()
          .duration(0)
          .delay(10)
          .call(this._position);

        transition.each(
          'end',
          utils.makeCounterFunc(
            transition.size(),
            this.view.animationNext.bind(this.view)
          ));
      }
    },

    _position: function() {
      this.style("left", function(d) { return d.x + "px"; })
        .style("top", function(d) { return d.y + "px"; })
        .style("width", function(d) { return d.dx + "px"; })
        .style("height", function(d) { return d.dy + "px"; })
        .style('display', function(d) {
          return (d.dx && d.dy) ? 'block' : 'none';
        });
    },

    _initD3: function() {
      var self = this;
      var width = 900,
          height = 600;

      this._valueFunc = function(d) {
        var fromData = self.view.displayedWeightData()[d.name];
        return fromData ? fromData.Weight : 0;
      };

      function text(d) {
        if (d.children) {
          return null;
        } else {
          return d.name.slice(0, 1) + d.name.slice(1).toLowerCase();
        }
      }

      this.root = d3.select("#d3-box")
        .style("width", width + "px")
        .style("height", height + "px");

      var color = d3.scale.category20b();

      this.treemap = d3.layout.treemap()
        .size([width, height])
        .sticky(true)
        .mode('slice-dice')
        .value(this._valueFunc);

      this.node = self.root
        .datum(this.view.model.sectorMap())
        .selectAll(".node")
        .data(this.treemap.nodes)
        .enter()
        .append("div")
        .attr("class", "node")
        .call(this._position)
        .style("background", function(d) {
          return d.children ? color(d.name) : null;
        })
        .attr('title', text)
        .text(text);
    },

    _initBindings: function() {
      var self = this;

      this.view.displayedWeightData.subscribe(
        this.update.bind(this)
      );

      this.animationInProgress = ko.computed(function() {
        return self.view.model.allWeightsFetched() &&
          self.view.animationInProgress();
      });
      this.animationInProgress.subscribe(
        this.update.bind(this)
      );
    },

    init: function() {
      this._initD3();
      this._initBindings();
    }
  };

  model.init();
  view.init();
  model.dataInitialized.subscribe(function(val) {
    if (val) { d3View.init(); }
  });

  ko.applyBindings(view);

}());
