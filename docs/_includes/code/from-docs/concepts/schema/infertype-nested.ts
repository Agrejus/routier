import { InferType, s } from "@routier/core/schema";

const companySchema = s.define("companies", {
    id: s.string().key().identity(),
    name: s.string(),
    address: s.object({
        street: s.string(),
        city: s.string(),
        state: s.string(),
        zipCode: s.string(),
        country: s.string().default("USA"),
    }),
    employees: s.array(s.object({
        id: s.string(),
        name: s.string(),
        email: s.string(),
        department: s.string(),
        role: s.string("admin", "manager", "employee"),
        salary: s.number().optional(),
        startDate: s.date(),
    })),
    departments: s.array(s.object({
        id: s.string(),
        name: s.string(),
        managerId: s.string().optional(),
        budget: s.number().optional(),
    })),
    metadata: s.object({
        founded: s.date(),
        industry: s.string(),
        size: s.string("startup", "small", "medium", "large"),
        isPublic: s.boolean().default(false),
    }),
}).compile();

type Company = InferType<typeof companySchema>;

// Complex type operations with full type safety
function findEmployeeByEmail(company: Company, email: string) {
    return company.employees.find(emp => emp.email === email);
}

function getDepartmentEmployees(company: Company, departmentId: string) {
    return company.employees.filter(emp => emp.department === departmentId);
}

function calculateTotalSalary(company: Company) {
    return company.employees
        .filter(emp => emp.salary !== undefined)
        .reduce((total, emp) => total + emp.salary!, 0);
}

function getCompanySummary(company: Company) {
    return {
        name: company.name,
        totalEmployees: company.employees.length,
        departments: company.departments.length,
        totalSalary: calculateTotalSalary(company),
        founded: company.metadata.founded,
        industry: company.metadata.industry,
        size: company.metadata.size,
    };
}

// Type-safe nested property access
function updateEmployeeRole(company: Company, employeeId: string, newRole: Company['employees'][0]['role']) {
    const employee = company.employees.find(emp => emp.id === employeeId);
    if (employee) {
        employee.role = newRole; // TypeScript ensures newRole is valid
    }
}

// Usage example
const company: Company = {
    id: "comp-123",
    name: "TechCorp",
    address: {
        street: "123 Tech St",
        city: "San Francisco",
        state: "CA",
        zipCode: "94105",
        country: "USA",
    },
    employees: [
        {
            id: "emp-1",
            name: "John Doe",
            email: "john@techcorp.com",
            department: "engineering",
            role: "manager",
            salary: 120000,
            startDate: new Date("2020-01-15"),
        },
    ],
    departments: [
        {
            id: "dept-1",
            name: "Engineering",
            managerId: "emp-1",
            budget: 500000,
        },
    ],
    metadata: {
        founded: new Date("2015-03-01"),
        industry: "Technology",
        size: "medium",
        isPublic: false,
    },
};

// All operations are fully type-safe
const john = findEmployeeByEmail(company, "john@techcorp.com");
const engineeringTeam = getDepartmentEmployees(company, "dept-1");
const summary = getCompanySummary(company);
updateEmployeeRole(company, "emp-1", "admin");
