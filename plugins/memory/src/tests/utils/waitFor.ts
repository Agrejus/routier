export const waitFor = async (fn: () => Promise<boolean>) => {
    return new Promise<boolean>((resovle, reject) => {
        try {
            const wait = async () => {

                const result = await fn();

                if (result === false) {
                    setTimeout(wait, 50);
                    return;
                }

                resovle(true);
            }

            wait();
        } catch (e) {
            reject(e);
        }
    });
}