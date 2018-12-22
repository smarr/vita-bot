import { expect } from "chai";
import { withData, readData, withoutData, encodeForHtmlComment, decodeFromHtmlComment } from "../src/issue-metadata";

describe("GitHub Issue Metadata encoding", function() {

  describe("Basic Encoding", function() {
    const comment = "Initial Comment\n";
    const simpleObj = {
      foo: "bar",
      baz: 323
    };

    const nestedObjects = {
      foo: "bar",
      baz: 323,
      obj: {
        obj: {
          obj: {
            "foo--bar": "baz\n fff",
            "32323": 32323.33
          }
        }
      }
    };

    it("Should be possible to encode a basic object in metadata", function() {
      const augmentedComment = withData(comment, simpleObj);
      const data = readData(augmentedComment);

      expect(data).to.deep.equal(simpleObj);
    });

    it("Should be possible to encode a nested objects in metadata", function() {
      const augmentedComment = withData(comment, nestedObjects);
      const data = readData(augmentedComment);

      expect(data).to.deep.equal(nestedObjects);
    });

    it("Should be possible update metadata", function() {
      const augmentedComment = withData(comment, nestedObjects);
      const updatedComment = withData(augmentedComment, simpleObj);

      const data = readData(updatedComment);

      expect(data).to.deep.equal(simpleObj);
      expect(augmentedComment.length).to.be.greaterThan(updatedComment.length);
    });

    it("Should be possible remove metadata", function() {
      const augmentedComment = withData(comment, nestedObjects);
      const restoredComment = withoutData(augmentedComment);

      expect(restoredComment).to.equal(comment);
    });
  });

  describe("Escaping", function() {
    it("Should be resilient to -- in data", function() {
      const examples = [
        "foobar--baz",
        "-- ddsd -- dsd d--f",
        "- 4 d- d sd-- sd"
      ];

      for (const str of examples) {
        const encoded = encodeForHtmlComment(str);

        expect(encoded).not.to.contain("--");
        const decoded = decodeFromHtmlComment(encoded);
        expect(decoded).to.equal(str);
      }
    });

    it("Should not break \\ characters", function() {
      const examples = [
        "fo\\oba\r--\n baz",
        "-- ddsd \-\- dsd d-------f",
        "- 4 d\- d sd-\- s--d"
      ];

      for (const str of examples) {
        const encoded = encodeForHtmlComment(str);

        expect(encoded).not.to.contain("--");
        const decoded = decodeFromHtmlComment(encoded);
        expect(decoded).to.equal(str);
      }
    });
  });
});
