## Wiki Mirror

This folder contains documents mirrored from [the Wiki](https://github.com/polymorpher/one-wallet/wiki). The purpose is to make it easy for collaborators to review the design documents, since GitHub wiki does not support pull requests and branches.

### How to contribute

Simply start your own branch, make changes in the document, then create a pull request, just like how you would contribute regular code.

### How to review

If you have comments on an existing document, you can create an [issue](https://github.com/polymorpher/one-wallet/issues) and copy-paste the permlink to the document with specific line number to start a discussion. GitHub issue will automatically quote the content around that line number when the issue is posted. 

A permlink is an URL that contains a specific commit number, e.g. 

> https://github.com/polymorpher/one-wallet/blob/5c6f13d7135fe4fdb80f693605931e328e009bd4/wiki/Home.md

You can obtain the permlink by first go to the file

> https://github.com/polymorpher/one-wallet/blob/master/wiki/Home.md

Then click `...` on the top right and click `Copy permlink`.

You can find the line number of the content by looking the document in blame mode, e.g.

> https://github.com/polymorpher/one-wallet/blame/master/wiki/Home.md

Once you get the line number, simply append `#Lxx` at the end of the permlink, where `xx` is the line number. For example:

> https://github.com/polymorpher/one-wallet/blob/5c6f13d7135fe4fdb80f693605931e328e009bd4/wiki/Home.md#L50