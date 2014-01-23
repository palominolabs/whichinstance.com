$(document).ready(function() {
    'use strict';
    var currency = 'USD',
        platform = 'linux',
        onDemandData = null,
        reservedData = {'heavy': null, 'medium': null, 'light': null},
        chart = new Highcharts.Chart({
            chart:       {
                renderTo: 'chart',
                type:     'line'
            },
            title:       {
                text: 'Instance cost'
            },
            xAxis:       {
                title: {
                    text: 'Days'
                }
            },
            yAxis:       {
                min: 0,
                title: {
                    text: 'Cost ($)'
                }
            },
            plotOptions: {
                series: {
                    marker: {
                        enabled: false
                    }
                }
            },
            tooltip:     {
                crosshairs: [true, true],
                formatter:  function() {
                    return this.series.name + '<br />Days: ' + this.x + '<br />Cost: $' + this.y.toFixed(2);
                }
            }
        }),

        regionCodeConfig = {
            'onDemand': {
                'us-east':    'us-east',
                'us-west':    'us-west',
                'us-west-2':  'us-west-2',
                'eu-ireland': 'eu-ireland',
                'apac-sin':   'apac-sin',
                'apac-tokyo': 'apac-tokyo',
                'apac-syd':   'apac-syd',
                'sa-east-1':  'sa-east-1'
            },
            'reserved': {
                'us-east':    'us-east',
                'us-west':    'us-west-1',
                'us-west-2':  'us-west-2',
                'eu-ireland': 'eu-west-1',
                'apac-sin':   'ap-southeast-1',
                'apac-tokyo': 'ap-northeast-1',
                'apac-syd':   'ap-southeast-2',
                'sa-east-1':  'sa-east-1'
            }
        },

        instanceSizes = {},
        instanceSizeToType = {},
        seriesData = [],
        pricePerHour,
        instanceFoundSomewhere = false,
        daysToShow = 365,
        utilizationFraction = 1.0,

        getRegionCode = function(onDemandOrInstance) {
            return regionCodeConfig[onDemandOrInstance][$('#region').find(':selected').val()];
        },

        getInstanceType = function(instanceSize) {
            return instanceSizeToType[instanceSize];
        },

        getInstanceSize = function() {
            return $('#insSize').find(':selected').val();
        },

        updateOnDemandData = function() {
            if (onDemandData == null) {
                console.log('on demand data not loaded');
                return;
            }

            var regionCode = getRegionCode('onDemand'),
                sizeCode = getInstanceSize(),
                insTypeCode = getInstanceType(sizeCode);

            $.each(onDemandData.config.regions, function(i, region) {
                if (region.region != regionCode) {
                    return true;
                }
                $.each(region.instanceTypes, function(j, insType) {
                    if (insType.type != insTypeCode) {
                        return true;

                    }
                    $.each(insType.sizes, function(k, size) {
                        if (size.size != sizeCode) {
                            return true;
                        }

                        $.each(size.valueColumns, function(l, sizeValue) {
                            if (sizeValue.name != platform) {
                                return true;
                            }

                            instanceFoundSomewhere = true;

                            pricePerHour = sizeValue.prices[currency];
                            seriesData.length = 0;
                            for (var d = 0; d < daysToShow; d++) {
                                seriesData.push(d * pricePerHour * 24 * utilizationFraction);
                            }

                            chart.addSeries({
                                data: seriesData,
                                name: "on demand"
                            });

                            return false;
                        });

                        return false;
                    });

                    return false;
                });

                return false;
            });
        },

        updateReservedData = function(utilizationLevelName, includeHourlyCostIncrementally) {
            if (reservedData[utilizationLevelName] == null) {
                console.log('reserved ' + utilizationLevelName + ' not loaded');
                return;
            }

            var regionCode = getRegionCode('reserved'),
                sizeCode = getInstanceSize(),
                insTypeCode = getInstanceType(sizeCode);

            $.each(reservedData[utilizationLevelName].config.regions, function(_, region) {
                if (region.region != regionCode) {
                    return true;
                }

                $.each(region.instanceTypes, function(_, type) {
                    if (type.type != insTypeCode) {
                        return true;
                    }

                    $.each(type.sizes, function(_, size) {
                        if (size.size != sizeCode) {
                            return true;
                        }

                        var priceData = {},
                            d,
                            f,
                            termLength,
                            termCounter;

                        // assemble a map of the various value columns
                        $.each(size.valueColumns, function(_, priceSpec) {
                            f = parseFloat(priceSpec.prices[currency]);
                            if (isNaN(f)) {
                                priceData[priceSpec.name] = null;
                            } else {
                                priceData[priceSpec.name] = f;
                            }
                        });

                        instanceFoundSomewhere = true;

                        // if 1 yr data was available, use it
                        if (priceData.yrTerm1 != null && priceData.yrTerm1Hourly != null) {
                            seriesData.length = 0;
                            pricePerHour = priceData.yrTerm1Hourly;
                            termLength = 365;
                            for (d = 0; d < daysToShow; d++) {
                                termCounter = 1 + Math.floor(d / termLength);
                                if (includeHourlyCostIncrementally) {
                                    seriesData.push(priceData.yrTerm1 * termCounter + d * pricePerHour * 24 * utilizationFraction);
                                } else {
                                    seriesData.push((priceData.yrTerm1 + termLength * pricePerHour * 24) * termCounter);
                                }
                            }
                            chart.addSeries({
                                data: seriesData,
                                name: "1 yr " + utilizationLevelName
                            });
                        }

                        // if 3 yr data was avilable, use it
                        if (priceData.yrTerm3 != null && priceData.yrTerm3Hourly != null) {
                            // 3 yr
                            seriesData.length = 0;
                            pricePerHour = priceData.yrTerm3Hourly;
                            termLength = 365 * 3;
                            for (d = 0; d < daysToShow; d++) {
                                termCounter = 1 + Math.floor(d / termLength);

                                if (includeHourlyCostIncrementally) {
                                    seriesData.push(priceData.yrTerm3 * termCounter + d * pricePerHour * 24 * utilizationFraction);
                                } else {
                                    seriesData.push((priceData.yrTerm3 + termLength * pricePerHour * 24) * termCounter);
                                }
                            }

                            chart.addSeries({
                                data: seriesData,
                                name: "3 yr " + utilizationLevelName
                            });
                        }

                        return false;
                    });

                    return false;
                });

                return false;
            })
        },

        onChange = function() {
            $('#spinner').show();

            window.setTimeout(function() {
                // clear the chart
                while (chart.series.length > 0) {
                    chart.series[0].remove();
                }

                instanceFoundSomewhere = false;

                daysToShow = parseInt($('#days').val());
                utilizationFraction = parseFloat($('#utilization').val()) / 100.0;

                updateOnDemandData();
                $.each(['medium', 'light'], function(_, obj) {
                    updateReservedData(obj, true);
                });
                updateReservedData('heavy', false);

                if (!instanceFoundSomewhere) {
                    var msg = "It doesn't appear that <strong>" + $('#region').find(':selected').text() + '</strong> has instance type <strong>' +
                        getInstanceType(getInstanceSize()) + '</strong> in size <strong>' + $('#insSize').find(':selected').text() + '</strong>. '
                        + 'Use <a href="https://aws.amazon.com/ec2/instance-types/">this page</a> for reference.';
                    $('#message').html(msg);
                } else {
                    $('#message').text('');
                }

                setTitle();

                $('#spinner').hide();
            }, 0);

        },

        initializeSizeDropdown = function() {
            for (var type in instanceSizes) {
                $("#insSize").append("<option disabled>" + humanizeCamelCase(type) + "</option>");

                for (var size in instanceSizes[type]) {
                    $("#insSize").append("<option value='" + size + "'>" + size + "</option>");
                }
            }
        },

        humanizeCamelCase = function(camelCase) {
            return camelCase.charAt(0).toUpperCase() + camelCase.slice(1).replace( /([A-Z])/g, " $1" );
        },

        setTitle = function() {
            var sizeCode = getInstanceSize(),
            title = $('#region').find(':selected').text() + ': ' + sizeCode;
            chart.setTitle({text: title});
        };

    $.each(['#region', '#insType', '#insSize', '#days', '#utilization'], function(_, obj) {
        $(obj).change(onChange);
    });

    $.getJSON('/js/linux-od.json',
        function(data) {
            onDemandData = data;

            // Build the sizes we know about and their instance type mappings
            $.each(onDemandData.config.regions, function(i, region) {
                $.each(region.instanceTypes, function(j, type) {
                    $.each(type.sizes, function(k, size) {
                        if (!(type.type in instanceSizes)) {
                            instanceSizes[type.type] = {}
                        }
                        instanceSizes[type.type][size.size] = true;
                        instanceSizeToType[size.size] = type.type;
                    });
                });
            });

            initializeSizeDropdown();
            updateOnDemandData();
            setTitle();
    });

    $.each(['medium', 'light'], function(_, obj) {
        $.getJSON('/js/linux-ri-' + obj + '.json',
            function(data) {
                reservedData[obj] = data;

                updateReservedData(obj, true);
            });
    });

    $.each(['heavy'], function(_, obj) {
        $.getJSON('/js/linux-ri-' + obj + '.json',
            function(data) {
                reservedData[obj] = data;

                updateReservedData(obj, false);
            });
    });
});
