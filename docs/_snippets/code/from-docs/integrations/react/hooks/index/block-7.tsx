if (result.status === "pending") return <Loading />;
if (result.status === "error") return <Error error={result.error} />;
return <DataView data={result.data} />;