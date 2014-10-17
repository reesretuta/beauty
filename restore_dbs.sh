~/mongodb/bin/mongorestore -h linus.mongohq.com --port 10012 -u heroku -p 9Izw1phkRws44gcsqmsXEg_mPapglY7ThwEGuW0N4qjeUJk9wtlJnLugnspflsXd_Vn6MNq293_HusVS2qBaBw -d app30274361 --drop mongo_dump/jafra
~/mongodb/bin/mongorestore -h candidate.40.mongolayer.com --port 10171 -u heroku -p qe0hSL0CTY-_FP3lzO3yyUx8wub2pXeaVOn7SkNYpSRsdTauTyRgY7YGxJVKj8oWvfSDrBeC9c0wqvWzaB6F1g -d app30498929 --drop mongo_dump/jafra
~/mongodb/bin/mongorestore -h candidate.41.mongolayer.com --port 10344 -u heroku -p k9XqebPL16Bzc-qSqXPl-h3SGCPxGg-U9pQ5p64aWQia_JIdpL3kNWi0AN5UvziVSa-PlY7eeLIpRn5A3in6dA -d app30703380 --drop mongo_dump/jafra

#jafra - mongodb://heroku:qe0hSL0CTY-_FP3lzO3yyUx8wub2pXeaVOn7SkNYpSRsdTauTyRgY7YGxJVKj8oWvfSDrBeC9c0wqvWzaB6F1g@candidate.41.mongolayer.com:10216,candidate.40.mongolayer.com:10171/app30498929
# jafra-prod - mongodb://heroku:k9XqebPL16Bzc-qSqXPl-h3SGCPxGg-U9pQ5p64aWQia_JIdpL3kNWi0AN5UvziVSa-PlY7eeLIpRn5A3in6dA@candidate.16.mongolayer.com:10600,candidate.41.mongolayer.com:10344/app30703380
