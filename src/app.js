const express = require('express');
const bodyParser = require('body-parser');
const {sequelize} = require('./model')
const {getProfile} = require('./middleware/getProfile')
const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize)
app.set('models', sequelize.models)
const {Contract, Profile, Job} = require('./model');
const {Sequelize, Op} = require("sequelize");

/**
 * FIX ME!
 * @returns contract by id
 */
app.get('/contracts/:id', getProfile, async (req, res) => {
    try {
        const contract = await Contract.findOne({
            where: {
                id: req.params.id,
                [Sequelize.Op.or]: [
                    {ClientId: req.profile.id},
                    {ContractorId: req.profile.id},
                ],
            },
            include: [
                {
                    model: Profile,
                    as: 'Client',
                },
                {
                    model: Profile,
                    as: 'Contractor',
                },
            ],
        });

        if (!contract) {
            return res.status(404).send({
                error: 'Contract not found or does not belong to you',
            });
        }

        return res.send(contract);
    } catch (error) {
        console.error(error);
        return res.status(500).send({error: 'Error fetching contract'});
    }
})

app.get('/contracts/', getProfile, async (req, res) => {
    try {
        const contracts = await Contract.findAll({
            where: {
                status: {
                    [Sequelize.Op.not]: 'terminated',
                },
                [Sequelize.Op.or]: [
                    {ClientId: req.profile.id},
                    {ContractorId: req.profile.id},
                ],
            },
            include: [
                {
                    model: Profile,
                    as: 'Client',
                },
                {
                    model: Profile,
                    as: 'Contractor',
                },
            ],
        });

        return res.send(contracts);
    } catch (error) {
        console.error(error);
        return res.status(500).send({error: 'Error fetching contracts'});
    }
})

app.get('/jobs/unpaid', getProfile, async (req, res) => {
    try {
        const jobs = await Job.findAll({
            include: [
                {
                    model: Contract,
                    where: {
                        status: 'in_progress',
                        [Sequelize.Op.or]: [
                            {ContractorId: req.profile.id},
                            {ClientId: req.profile.id},
                        ],
                    },
                },
            ],
            where: {
                [Sequelize.Op.or]: [
                    {paid: null},
                    {paid: 0},
                ],
            },
        });

        return res.send(jobs);
    } catch (error) {
        console.error(error);
        return res.status(500).send({error: 'Error fetching unpaid jobs'});
    }
})

app.post('/jobs/:job_id/pay', getProfile, async (req, res) => {
    const {job_id} = req.params;
    const clientId = req.profile.id;

    // Start a transaction
    const t = await sequelize.transaction();

    try {
        // Find the job by id and make sure it belongs to the client
        const job = await Job.findOne({
            include: [
                {
                    model: Contract,
                    where: {
                        ClientId: clientId
                    },
                },
            ],
            where: {
                id: job_id,
            },
        });

        if (!job) {
            throw new Error('Job not found or doesn\'t belong to the client');
        }

        // Make sure the job hasn't been paid yet
        if (job.paid) {
            throw new Error('Job has already been paid');
        }

        // Find the client profile and make sure the balance is sufficient
        //Ensure that the data is isolated from other transactions until the lock is released
        const client = await Profile.findOne({
            where: {id: clientId, type: 'client'},
            lock: t.LOCK.UPDATE
        });

        if (!client) {
            throw new Error('Client not found');
        }

        if (client.balance < job.price) {
            throw new Error('Insufficient balance');
        }

        // Find the contractor profile
        const contractor = await Profile.findOne({
            where: {id: job.Contract.ContractorId, type: 'contractor'},
            lock: t.LOCK.UPDATE
        });

        if (!contractor) {
            throw new Error('Contractor not found');
        }

        // Deduct the job price from the client balance and add to the contractor balance
        await client.update({balance: client.balance - job.price}, {transaction: t});
        await contractor.update({balance: contractor.balance + job.price}, {transaction: t});

        // Mark the job as paid
        await job.update({paid: true, paymentDate: new Date()}, {transaction: t});

        // Commit the transaction
        await t.commit();

        res.sendStatus(200);
    } catch (error) {
        // Rollback the transaction if something went wrong
        await t.rollback();

        res.status(400).send({error: error.message});
    }
})

app.post('/balances/deposit/:userId', getProfile, async (req, res) => {
    const {userId} = req.params;
    const {amount} = req.body;
    try {
        const client = await Profile.findOne({where: {id: userId, type: 'client'}});
        if (!client) return res.status(404).json({error: 'Client not found'});
        const jobsToPay = await Job.sum('price', {
            include: [
                {
                    model: Contract,
                    where: {
                        ClientId: userId
                    },
                },
            ], where: {
                [Sequelize.Op.or]: [
                    {paid: null},
                    {paid: 0},
                ],
            }
        });
        if (amount > jobsToPay * 0.25) {
            return res.status(400).json({error: `Cannot deposit more than 25% of jobs to pay, max amount is ${jobsToPay * 0.25}`});
        }

        await sequelize.transaction(async (t) => {
            await client.update({balance: client.balance + amount}, {transaction: t});
        });
        return res.status(200).json({message: 'Balance updated successfully'});
    } catch (error) {
        return res.status(500).json({error: error.message});
    }
})

app.get('/admin/best-profession', getProfile, async (req, res) => {
    try {
        const start = req.query.start;
        const end = req.query.end;

        const bestProfession = await Job.findAll({
            include: [
                {
                    model: Contract,
                    include: [
                        {
                            model: Profile,
                            as: 'Contractor',
                            where: {
                                profession: {
                                    [Sequelize.Op.ne]: null
                                }
                            }
                        }
                    ],
                    where: {
                        [Sequelize.Op.and]: [
                            {
                                createdAt: {
                                    [Sequelize.Op.gte]: start
                                }
                            },
                            {
                                createdAt: {
                                    [Sequelize.Op.lte]: end
                                }
                            }
                        ]
                    }
                }
            ],
            where: {
                paid: true
            },
            group: [
                'Contract.Contractor.profession'
            ],
            attributes: [
                'Contract.Contractor.profession',
                [Sequelize.fn('SUM', Sequelize.col('price')), 'total']
            ],
            order: [
                [Sequelize.fn('SUM', Sequelize.col('price')), 'DESC']
            ]
        });

        if (!bestProfession && bestProfession.length === 0) {
            return res.status(404).send({message: 'No profession found for the given date range'});
        }
        const result = {
            profession: bestProfession[0].Contract.Contractor.profession,
            total: bestProfession[0].dataValues.total
        };

        return res.status(200).send(result);
    } catch (error) {
        res.status(500).send({message: 'Error fetching best profession' + error});
    }
})


app.get('/admin/best-clients', getProfile, async (req, res) => {
    const {start, end, limit = 2} = req.query;

    try {
        let bestClients = await Job.findAll({
            where: {
                paymentDate: {
                    [Op.gte]: start,
                    [Op.lte]: end
                },
                paid: true
            },
            include: [{
                model: Contract,
                as: 'Contract',
                include: [{
                    model: Profile,
                    as: 'Client',
                }]
            }],
            order: [[sequelize.col('price'), 'DESC']],
            limit,
            group: [
                'Contract.Client.id'
            ],
            attributes: [[sequelize.fn('SUM', sequelize.col('price')), 'total_paid'], 'Contract.Client.firstName', 'Contract.Client.lastName']
        });

        bestClients = bestClients.map(client => {
            return {
                id: client.Contract.Client.id,
                name: `${client.Contract.Client.firstName} ${client.Contract.Client.lastName}`,
                total_paid: client.dataValues.total_paid
            }
        });
        res.json({bestClients});
    } catch (error) {
        res.status(500).send('Error Occurred' + error);
    }
})

module.exports = app;
