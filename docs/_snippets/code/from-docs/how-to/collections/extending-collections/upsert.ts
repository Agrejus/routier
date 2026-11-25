import { Collection, DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";
import type { InferCreateType, InferRoot, InferType } from "@routier/core/schema";

const contactSchema = s
    .define("contacts", {
        id: s.string().key(),
        name: s.string(),
        email: s.string(),
    })
    .compile();

type Contact = InferType<typeof contactSchema>;
type NewContact = InferCreateType<typeof contactSchema>;

class ContactCollection extends Collection<InferRoot<typeof contactSchema>> {
    async upsertAsync(contact: NewContact): Promise<Contact> {
        const existing = await this.firstOrUndefinedAsync(([c, p]) => c.id === p.id, { id: contact.id });

        if (existing == null) {
            const [added] = await this.addAsync(contact);
            return added;
        }

        Object.assign(existing, contact);
        return existing;
    }

    async removeByEmailDomainAsync(domain: string): Promise<Contact[]> {
        return this.where(([c, p]) => c.email.endsWith(p.domain), { domain }).removeAsync();
    }
}

class AppDataStore extends DataStore {
    contacts: ContactCollection = this.collection(contactSchema).proxy().create((_, dependencies) => new ContactCollection(dependencies));

    constructor() {
        super(new MemoryPlugin("app"));
    }
}

const ctx = new AppDataStore();

await ctx.contacts.upsertAsync({ id: "c1", name: "Ada", email: "ada@example.com" });
await ctx.saveChangesAsync();

await ctx.contacts.upsertAsync({ id: "c1", name: "Ada Lovelace", email: "ada@example.com" });
await ctx.contacts.removeByEmailDomainAsync("@old.example.com");
await ctx.saveChangesAsync();
