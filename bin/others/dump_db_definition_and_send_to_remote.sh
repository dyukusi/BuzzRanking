mysqldump -u root -p trend_ranking -d > trend_ranking.dump
scp ./trend_ranking.dump buzzranking.net:~
