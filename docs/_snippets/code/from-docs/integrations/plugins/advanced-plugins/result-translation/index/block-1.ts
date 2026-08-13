translate(data: unknown): TShape {
    this.query.options.forEach(item => {
        data = this.functionMap[item.name](data, item);
    });
    return data as TShape;
}