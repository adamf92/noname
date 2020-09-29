import { kebabCase, kebabCaseDeep, camelCase } from "./utils";

describe("kebabCase", () => {
  it("should convert strings to kebab case", () => {
    expect(kebabCase("")).toBe("");
    expect(kebabCase("testIdent")).toBe("test-ident");
    expect(kebabCase("TestIdent")).toBe("test-ident");
    expect(kebabCase("testIdent123")).toBe("test-ident123");
    expect(kebabCase("test123Ident")).toBe("test123-ident");
  });
});

describe("camelCase", () => {
  it("should convert strings to camel case", () => {
    expect(camelCase("test-ident")).toBe("testIdent");
    expect(camelCase("test-123-ident")).toBe("test123Ident");
  });
});

describe("kebabCaseDeep", () => {
  it("should handle complex objects properly", () => {
    expect(
      kebabCaseDeep({
        keyOne: [
          {
            subKeyOne: "1",
            subKeyTwo: [2, 4]
          }
        ],
        keyTwo: {
          subKeyThree: [
            {
              subSubKeyOne: null
            }
          ],
          subKeyFour: ["valOne", "valueTwo"]
        }
      })
    ).toEqual({
      "key-one": [
        {
          "sub-key-one": "1",
          "sub-key-two": [2, 4]
        }
      ],
      "key-two": {
        "sub-key-three": [
          {
            "sub-sub-key-one": null
          }
        ],
        "sub-key-four": ["valOne", "valueTwo"]
      }
    });
  });
});