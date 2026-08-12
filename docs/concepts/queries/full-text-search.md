---
title: Full-Text Search
layout: default
parent: Queries
nav_order: 9
permalink: /concepts/queries/full-text-search/
---

# Full-Text Search

Rank documents by the words they contain, with the same results on every backend.

## Quick Navigation

- [A First Search](#a-first-search)
- [Declaring What Is Searchable](#declaring-what-is-searchable)
- [Matching All Or Any Terms](#matching-all-or-any-terms)
- [Searching One Field](#searching-one-field)
- [The Score](#the-score)
- [Composing With Other Operations](#composing-with-other-operations)
- [Tokenizer Options](#tokenizer-options)
- [Keeping The Index Healthy](#keeping-the-index-healthy)
- [What It Costs](#what-it-costs)
- [Limits](#limits)
- [Related](#related)

## A First Search

Mark the string properties you want to search, declare the index on the collection, and query it:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/full-text-search/block-1.ts %}{% endhighlight %}


`hits` holds the articles that contain both words, best match first.

## Declaring What Is Searchable

Two things are needed, and they do different jobs.

`.searchable()` on a property says the property **could** be indexed. It is valid on strings
only, including optional and nullable ones — an absent value contributes no words. The builder
does not offer the method on a number or a date, so a wrong declaration does not compile.

`.fullTextSearch()` on the collection says the index **exists**. Mark properties without it and
you pay nothing: no index is created and no save writes to one.

Routier throws when the schema compiles if you mark a string inside an `s.object()`. Version 1
indexes root-level properties only.

## Matching All Or Any Terms

`search` requires every word by default, because that is what a search box means — adding a word
narrows the results.


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/full-text-search/block-2.ts %}{% endhighlight %}


There are two modes: `'all'` (the default) and `'any'`.

A query with no words returns nothing. An empty string, punctuation alone, or a query made
entirely of stop words all produce no results rather than every result.

## Searching One Field

Pass a selector to search one property, or an array to search several:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/full-text-search/block-3.ts %}{% endhighlight %}


A selector that names a property without `.searchable()` throws. Returning no results would look
like an empty index rather than a mistake.

## The Score

Every result carries a readonly `score`. It is the number of times the query's words appear in
the document, across the fields that were searched:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/full-text-search/block-4.ts %}{% endhighlight %}


Results are ordered by score, highest first. Documents with equal scores are ordered by key, so
two runs over the same data always return the same order.

The score is **not** a stored property. It does not appear in `Object.keys`, it does not survive
`JSON.stringify`, and it is never written to the database.

**Do not persist a score or compare one across versions.** The ordering is the contract; the
number is not. A later version may rank differently — by normalising for document length, for
example — without that being a breaking change.

## Composing With Other Operations

A search composes like a query:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/full-text-search/block-5.ts %}{% endhighlight %}


- `where` narrows which documents can match. It runs on the database.
- `sort` replaces the ranking with your own order.
- `skip` and `take` apply after the ranking, so `take(10)` gives the ten best matches.
- `map` projects the result and drops the score.


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/full-text-search/block-6.ts %}{% endhighlight %}


Terminal methods are `toArrayAsync`, `firstOrUndefinedAsync` and `countAsync`.

Collection scopes apply. A soft-deleted document never appears in a search result.

## Tokenizer Options

Every option has a default, so `.fullTextSearch()` with no argument is a complete declaration.


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/full-text-search/block-7.ts %}{% endhighlight %}


Routier splits text on anything that is not a letter or a digit, and it counts Unicode letters
as letters. `café` and `日本語` are single words.

A word longer than `maxTokenLength` is **shortened, not dropped**, so a pasted 200-character URL
stays findable by its first 64 characters.

Stop words are off by default for two reasons. A stop list is language-specific, so an English
default silently removes words from data in other languages. Stop words also change what you can
find at all: with the list on, a search for "to be or not to be" has no words left and returns
nothing. `minTokenLength: 2` already removes the noisiest words with no assumption about
language.

Supply `tokenizer` to replace the whole pipeline with your own function:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/full-text-search/block-8.ts %}{% endhighlight %}


The same function runs on your documents and on your queries. It must return the same words for
the same text every time. Setting `tokenizer` together with `lowercase`, `minTokenLength`,
`maxTokenLength` or `stopWords` throws, because a tokenizer replaces all of them.

## Keeping The Index Healthy

Routier maintains the index as you save. Index rows for an edit or a removal are written in the
same transaction as the document, so on a backend with atomic batches the two cannot disagree.

One case is different. When the database assigns your key — `.identity()` — a new document's
index rows are written immediately after the document, because the row's key contains the
document's key and that key does not exist until the insert runs. If the process stops between
the two writes, that document is not findable until you repair the index.

Two methods handle it:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/full-text-search/block-9.ts %}{% endhighlight %}


`check` reports without writing. `rebuild` makes the index match your documents and writes only
the differences, so a healthy index costs two reads and no writes.

Run this on a schedule. Check before you repair: a job that silently fixes drift also hides
whatever caused it.

`rebuild` also builds the index the first time. Declare `.fullTextSearch()` on a collection that
already holds documents, run `rebuild` once, and the existing documents become searchable.

Both methods read every document, so run them in a scheduled job rather than on a request.

## What It Costs

A document adds one index row for each distinct word in each searchable field. A 500-word
article adds roughly 300 rows.

Editing one field re-indexes that field only. Editing a title leaves a 4,000-character body
untouched.

Collections that use `diff()` change tracking re-index every searchable field on any edit,
because that mode detects changes with a content hash and cannot say which property moved.

## Limits

State these to yourself before you build on it:

- **Ranking counts words.** There is no BM25 and no length normalisation. A long document that
  repeats a word outranks a short document that uses it once.
- **No stemming.** "run" does not match "running". Supply a `tokenizer` if you need it.
- **No phrase or proximity search.** `search('copper pipe')` finds documents containing both
  words anywhere, not the phrase.
- **One index per collection.** Searching across collections is not supported.
- **Root-level string properties only.**
- **One key property.** A collection with a composite key cannot declare an index.
- **Exclude the index from replication.** The index is derived from documents each client
  already has, so a synced copy is a second writer competing with the local one. Excluding a
  collection from sync is ordinary replication configuration.

Routier does not use the search built into your database — SQLite FTS5, PostgreSQL `tsvector` or
MySQL `FULLTEXT`. Those tokenize, stem and rank differently, so the same query would return
different rows in a different order on each backend. Routier tokenizes and ranks itself, and
uses the database for what every engine does the same way: finding the index rows that hold your
words. If you need a specific engine's ranking, use that engine directly.

## Related

- [Filtering](/concepts/queries/filtering/) — narrowing a search with `where`
- [Sorting](/concepts/queries/sorting/) — replacing the ranking
- [Pagination](/concepts/queries/pagination/) — `skip` and `take`
- [Joins](/concepts/queries/joins/) — pairing collections on a key
