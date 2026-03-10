import { DataStore } from "@routier/datastore";
import { userSchema, userOrganizationSchema } from "./schemas";

export class AppDataStore extends DataStore {
    constructor(private readonly userSub: string) {
        super();

        this.users = this.usersFactory(userSub);
        this.userOrganizations = this.userOrganizationsFactory(userSub);
    }

    usersFactory = (userSub: string) =>
        this.collection(userSchema)
            .scope(([x, p]) => x.userRef === p.userSub, { userSub })
            .create();

    userOrganizationsFactory = (userSub: string) =>
        this.collection(userOrganizationSchema)
            .scope(([x, p]) => x.userRef === p.userSub, { userSub })
            .create();

    // Keep strong inferred collection types from the factory return types.
    users: ReturnType<AppDataStore["usersFactory"]>;
    userOrganizations: ReturnType<AppDataStore["userOrganizationsFactory"]>;
}
