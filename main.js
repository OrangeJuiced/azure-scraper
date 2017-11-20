const Http = require('https');
const Fs = require('fs-extra');
const Async = require('async');
const Cheerio = require('cheerio');

const pages = 10;

let partners = {
    data: []
};

for(let page = 1; page <= pages; page++) {
    setTimeout(getBasics, 2000 * page, page);
}

function getBasics(page) {
    let options = {
        host: 'azure.microsoft.com',
        path: '/nl-nl/partners/directory/?page=' + page,
        method: 'GET'
    };

    Async.waterfall([
        function(callback) {
            Http.get(options, function(res) {
                let body = '';

                res.on('data', function(chunk) {
                    body += chunk;
                });

                res.on('end', function() {
                    callback(null, body);
                });
            });
        },
        function(body, callback) {
            let $ = Cheerio.load(body);
            let partners_list = [];
            $('div .product-placement a').each(function(i, element) {
                console.log('Getting basic information for partner: ' + $(this).attr('title'));
                partners_list.push({'name': $(this).attr('title'), 'href': $(this).attr('href')});
            });

            callback(null, partners_list);
        }
    ],
    function(err, partners_list) {
        if(err) {
            console.log(err);
        } else {
            getDetails(partners_list);
        }
    });
}

function getDetails(partners_list) {
    Async.each(partners_list, function(partner, callback) {
        console.log('Getting details for partner: ' + partner.name);
        let products = [];

        let options = {
            host: 'azure.microsoft.com',
            path: partner.href,
            method: 'GET'
        };

        Async.waterfall([
            function(finished) {
                Http.get(options, function(res) {
                    let body = '';

                    res.on('data', function(chunk) {
                        body += chunk;
                    });

                    res.on('end', function() {
                        finished(null, body);
                    });
                });
            },
            function(body, finished) {
                let products = [];
                let solutions = [];

                let $ = Cheerio.load(body);

                Async.series([
                    function(done) {
                        $("[aria-label='Gerelateerde Azure-producten'] .medium-4 h3 a").each(function(i, element) {
                            products.push($(this).html());
                        });
                        done();
                    },
                    function(done) {
                        $("[aria-label='Azure-oplossingen'] .medium-4 a h3").each(function(i, element) {
                            solutions.push($(this).html());
                        });
                        done();
                    }
                ], function(err) {
                    partners.data.push({ 'name': partner.name, 'products': products, 'solutions': solutions });
                    finished(null, body);
                });

            }
        ],
        function(err, result) {
            if(err) {
                console.log(err);
            } else {
                callback();
            }
        });
    }, function(err) {
        if(err) {
            console.log(err);
        } else {
            console.log('Writing to file..');
            let json = JSON.stringify(partners, null, 4);
            Fs.writeFile('data.json', json, 'utf8');
        }
    });
}
