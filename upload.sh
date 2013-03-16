#!/bin/bash -e

cd `dirname $0`

s3cmd -c ~/.s3cfg-pl sync js img css index.html robots.txt s3://whichinstance.com/
