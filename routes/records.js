var express = require('express');
var router = express.Router();
var azure = require('azure-storage');
var entGen = azure.TableUtilities.entityGenerator;

var storageAccountName = "dansstore";
var storageAccountKey = "P5+vMg9qq5ryq04d0OfOny2N///DXz9Mopmo52hlswCgZeeDSW1SNFSwX9AAYDCpzE6bEN9jjrBnRtuo2SD5fg==";

var globalTable = 'records';
var globalPartition = 'partition1';

/* GET records listing. */
router.get('/', function(req, res) {
    var retryOperations = new azure.ExponentialRetryPolicyFilter();
    var tableSvc = azure.createTableService(storageAccountName, storageAccountKey).withFilter(retryOperations);

    tableSvc.createTableIfNotExists(globalTable, function(error, result, response) {
        if(!error) {
            var query = azure.TableQuery()
            // .top(5);
            //.where('PartitionKey eq ?', 'part2');

            tableSvc.queryEntities(globalTable, query, null, function(error, result, response) {
                if(!error) {
                    var data = result.entries.map(function(entry) {
                        return {
                            score: entry.score._,
                            level: entry.level._,
                            difficulty: entry.difficulty._
                        };
                    });
                    res.json(data);
                } else {
                    res.status(500).send("Error querying records");
                }
            });
        } else {
            res.status(500).send("cannot find reference to table");
        }
    });
});

/* POST a new record. */
router.post('/', function(req, res) {
    var newRecord = {
        PartitionKey: entGen.String(globalPartition),
        RowKey: entGen.String(req.body.deviceId),
        score: entGen.Int32(req.body.score),
        level: entGen.Int32(req.body.level),
        difficulty: entGen.String(req.body.difficulty)
    };

    var retryOperations = new azure.ExponentialRetryPolicyFilter();
    var tableSvc = azure.createTableService(storageAccountName, storageAccountKey).withFilter(retryOperations);

    tableSvc.createTableIfNotExists(globalTable, function(error, result, response) {
        if(!error) {
            // Try to retrieve the entitiy
            tableSvc.retrieveEntity(globalTable, globalPartition, req.body.deviceId, function(error, result, response) {
                if(!error){
                    // result contains the entity
                    if (result.entity) {
                        if (newRecord.score > result.entity.score) {
                            // new high score for this device id
                            tableSvc.updateEntity(globalTable, newRecord, function(error, result, response) {
                                if (!error) {
                                    res.status(200).send("New record updated");
                                } else {
                                    res.status(500).send("Error updating record");
                                }
                            });
                        } else {
                            res.status(204).send("Higher score already achieved");
                        }
                    } else {
                        // first record in the table
                        tableSvc.insertEntity(globalTable, newRecord, function(error, result, response) {
                            if (!error) {
                                res.status(201).send("First record inserted");
                            } else {
                                res.status(500).send("Error inserting first record");
                            }
                        });
                    }
                } else {
                    tableSvc.insertEntity(globalTable, newRecord, function(error, result, response) {
                        if (!error) {
                            res.status(201).send("First record inserted");
                        } else {
                            res.status(500).send("Error inserting first record");
                        }
                    });
                }
            });
        } else {
            res.status(500).send("cannot find reference to table");
        }
    });
});

module.exports = router;
