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

module.exports = app;
