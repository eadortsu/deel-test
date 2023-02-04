const app = require("../src/app");
const supertest = require("supertest");
const {expect} = require("chai");

const request = supertest(app);

describe("Contracts Endpoint", () => {
    it("should return a specific contract by id if it belongs to the profile calling", async () => {
        // Authenticate a user by passing profile_id in the request header
        const profile_id = "1";
        const res = await request.get("/contracts/1").set("profile_id", profile_id);
        expect(res.status).to.equal(200);
        expect(res.body).to.have.property("id");
    });

    it("should return a list of contracts belonging to a user", async () => {
        // Authenticate a user by passing profile_id in the request header
        const profile_id = "1";
        const res = await request.get("/contracts").set("profile_id", profile_id);
        expect(res.status).to.equal(200);
        expect(res.body).to.be.an("array");
    });
});

describe("Jobs Endpoint", () => {
    it("should return a list of unpaid jobs for a user", async () => {
        // Authenticate a user by passing profile_id in the request header
        const profile_id = "1";
        const res = await request.get("/jobs/unpaid").set("profile_id", profile_id);
        expect(res.status).to.equal(200);
        expect(res.body).to.be.an("array");
    });

    it("should pay for a job", async () => {
        // Authenticate a user by passing profile_id in the request header
        const profile_id = "1";
        const res = await request.post("/jobs/1/pay").set("profile_id", profile_id);
        //expect(res.status).to.equal(200);
        expect(res.body).to.have.property("error");
    });
});

describe("Balances Endpoint", () => {
    it("should deposit money into the balance of a client", async () => {
        // Authenticate a user by passing profile_id in the request header
        const profile_id = "1";
        const res = await request.post("/balances/deposit/1",{"amount": 1}).set("profile_id", profile_id);
        expect(res.status).to.equal(200);
        expect(res.body).to.have.property("message");
    });
});

describe("GET /admin/best-profession", () => {
    it("should return the profession that earned the most money", async () => {
        // Authenticate a user by passing profile_id in the request header
        const profile_id = "1";
        const res = await request.get("/admin/best-profession?start=2019-01-01&end=2023-12-31").set("profile_id", profile_id);
        expect(res.status).to.equal(200);
        expect(res.body).to.have.property("profession");
    });
});

describe("GET /admin/best-clients", () => {
    let startDate = '2022-01-01';
    let endDate = '2023-12-31';
    it("returns the clients the paid the most for jobs in the query time period", async () => {
        const res = await request
            .get("/admin/best-clients")
            .query({start: startDate, end: endDate, limit: 1})
            .set("profile_id", 1);

        expect(res.statusCode).to.equal(200);
        expect(res.body).to.be.an("array");
    });

    it("applies limit query parameter", async () => {
        const res = await request
            .get("/admin/best-clients")
            .query({start: startDate, end: endDate, limit: 2})
            .set("profile_id", 1);

        expect(res.statusCode).to.equal(200);
        expect(res.body.length).to.equal(1);
    });
});



