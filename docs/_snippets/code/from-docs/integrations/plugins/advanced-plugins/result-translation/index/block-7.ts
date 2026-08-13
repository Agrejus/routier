import { DataTranslator } from "@routier/core/plugins/translators/DataTranslator";
import { QueryOption } from "@routier/core/plugins/query/types";

export class MyCustomTranslator<
  TRoot extends {},
  TShape
> extends DataTranslator<TRoot, TShape> {
  // Override only the methods that need custom behavior
  count<TResult extends number>(
    data: unknown,
    option: QueryOption<TShape, "count">
  ): TResult {
    // Custom count handling
    return data.length as TResult;
  }

  // Other methods can use base class behavior
  // or override for backend-specific needs
}