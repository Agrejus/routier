export function expressionToWhereClause(expr: Expression): {
  where: string;
  params: any[];
} {
  const params: any[] = [];

  function walk(e: Expression): string {
    if (e.type === "operator") {
      const op = (e as OperatorExpression).operator;
      const left = walk(e.left);
      const right = walk(e.right);
      const sqlOp = op === "&&" ? "AND" : op === "||" ? "OR" : op;
      return `(${left} ${sqlOp} ${right})`;
    }

    if (e.type === "comparator") {
      const cmp = e as ComparatorExpression;
      const leftExpr = walk(cmp.left);
      const rightExpr = walk(cmp.right);

      // Translate comparator to SQL operator
      switch (cmp.comparator) {
        case "equals":
          return `${leftExpr} = ${rightExpr}`;
        case "greater-than":
          return `${leftExpr} > ${rightExpr}`;
        // ... etc
      }
    }

    if (e.type === "property") {
      return `"${(e as PropertyExpression).property.name}"`;
    }

    if (e.type === "value") {
      params.push((e as ValueExpression).value);
      return "?"; // Parameter placeholder
    }

    throw new Error(`Unknown expression type: ${(e as any).type}`);
  }

  const where = walk(expr);
  return { where, params };
}